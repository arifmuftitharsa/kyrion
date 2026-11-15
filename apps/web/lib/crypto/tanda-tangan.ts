import {
  createHash,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
  type KeyObject,
} from "node:crypto";

// Tanda tangan Ed25519 (RFC 8032) untuk pengesahan versi (F-32). Modul ini tidak
// membaca atau menulis berkas; penyimpanan kunci menjadi urusan pemanggil.

const PANJANG_TANDA_TANGAN = 64;
const PANJANG_ID_KUNCI = 32;

export interface PasanganKunci {
  /** Kunci publik format SPKI DER. */
  kunciPublikDer: Buffer;
  /** Kunci privat format PKCS8 PEM. */
  kunciPrivatPem: string;
}

export function bangkitkanPasanganKunci(): PasanganKunci {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    kunciPublikDer: publicKey.export({ type: "spki", format: "der" }),
    kunciPrivatPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };
}

/** 32 karakter hex pertama dari SHA-256 atas SPKI DER. */
export function idKunci(kunciPublikDer: Uint8Array): string {
  return createHash("sha256").update(kunciPublikDer).digest("hex").slice(0, PANJANG_ID_KUNCI);
}

/** Tanda tangan 64 byte. Ed25519 deterministik: pesan sama menghasilkan tanda tangan sama. */
export function tandatangani(pesan: Uint8Array, kunciPrivat: string | Buffer | KeyObject): Buffer {
  return sign(null, pesan, kunciPrivat);
}

/** Gagal tertutup: panjang salah atau galat apa pun menghasilkan false, tidak pernah melempar. */
export function verifikasiTandaTangan(
  pesan: Uint8Array,
  tandaTangan: Uint8Array,
  kunciPublikDer: Uint8Array,
): boolean {
  if (tandaTangan.byteLength !== PANJANG_TANDA_TANGAN) return false;
  try {
    const kunci = createPublicKey({ key: Buffer.from(kunciPublikDer), format: "der", type: "spki" });
    return verify(null, pesan, kunci, tandaTangan);
  } catch {
    return false;
  }
}
