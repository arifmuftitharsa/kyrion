import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";

// promisify(scrypt) kehilangan overload berparameter options; tipenya ditulis eksplisit.
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
) => Promise<Buffer>;

export interface ScryptParams {
  N: number;
  r: number;
  p: number;
  keyLength: number;
}

// OWASP Password Storage Cheat Sheet, opsi scrypt N=2^16 (64 MiB), r=8, p=2.
// Terukur ±158 ms per hash di laptop pengembangan (Node v24.19.0).
export const SCRYPT_PARAMS: ScryptParams = { N: 2 ** 16, r: 8, p: 2, keyLength: 32 };

const SALT_BYTES = 16;
const PREFIX = "scrypt";

// Batas parameter yang diterima saat verifikasi: mencegah baris DB rusak atau
// dimanipulasi memaksa server memakai memori/CPU berlebihan.
const N_MIN = 2 ** 13;
const N_MAX = 2 ** 20;
const R_MAX = 32;
const P_MAX = 16;
const HASH_MIN_BYTES = 16;
const HASH_MAX_BYTES = 64;

const DECIMAL = /^[1-9][0-9]{0,9}$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Memori scrypt kira-kira 128·N·r byte; default Node (32 MiB) terlalu kecil untuk N=2^16 r=8. */
function maxmemFor({ N, r }: ScryptParams): number {
  return 2 * 128 * N * r;
}

function derive(password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  const { N, r, p, keyLength } = params;
  return scryptAsync(password, salt, keyLength, { N, r, p, maxmem: maxmemFor(params) });
}

/**
 * Hash kata sandi dengan salt acak 16 byte dari CSPRNG. Format tersimpan
 * mendeskripsikan diri: "scrypt$N$r$p$<salt base64>$<hash base64>", sehingga
 * parameter bisa dinaikkan nanti tanpa merusak hash lama.
 */
export async function hashPassword(
  password: string,
  params: ScryptParams = SCRYPT_PARAMS,
): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await derive(password, salt, params);
  const { N, r, p } = params;
  return [PREFIX, N, r, p, salt.toString("base64"), hash.toString("base64")].join("$");
}

interface ParsedHash {
  params: ScryptParams;
  salt: Buffer;
  hash: Buffer;
}

/** Mengurai hash tersimpan; undefined bila format atau parameter tidak sah. */
function parse(stored: string): ParsedHash | undefined {
  const parts = stored.split("$");
  if (parts.length !== 6) return undefined;
  const [prefix, nText, rText, pText, saltText, hashText] = parts;
  if (prefix !== PREFIX) return undefined;
  if (![nText, rText, pText].every((t) => DECIMAL.test(t))) return undefined;
  // Validasi base64 SEBELUM Buffer.from: Buffer.from(..., "base64") diam-diam
  // mengabaikan karakter tidak valid sehingga input rusak bisa lolos.
  if (!BASE64.test(saltText) || !BASE64.test(hashText)) return undefined;

  const N = Number(nText);
  const r = Number(rText);
  const p = Number(pText);
  const isPowerOfTwo = (N & (N - 1)) === 0;
  if (!isPowerOfTwo || N < N_MIN || N > N_MAX || r > R_MAX || p > P_MAX) return undefined;

  const salt = Buffer.from(saltText, "base64");
  const hash = Buffer.from(hashText, "base64");
  if (salt.length < SALT_BYTES) return undefined;
  if (hash.length < HASH_MIN_BYTES || hash.length > HASH_MAX_BYTES) return undefined;

  return { params: { N, r, p, keyLength: hash.length }, salt, hash };
}

/**
 * Memeriksa kata sandi terhadap hash tersimpan. Format rusak, parameter di luar
 * batas, atau galat scrypt menghasilkan false (gagal tertutup), tidak melempar.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parse(stored);
  if (!parsed) return false;
  try {
    const actual = await derive(password, parsed.salt, parsed.params);
    // Waktu konstan; panjang sama karena keyLength diambil dari hash tersimpan.
    return timingSafeEqual(actual, parsed.hash);
  } catch {
    return false;
  }
}
