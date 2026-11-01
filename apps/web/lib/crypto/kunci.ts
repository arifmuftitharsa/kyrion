import { randomBytes } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";

// Kunci induk F-31: 32 byte acak, disimpan sebagai teks hex di berkas di luar
// repository dan di luar basis data. Modul ini tidak membaca variabel lingkungan;
// lokasi berkas selalu diberikan pemanggil.

const KUNCI_INDUK_BYTES = 32;
const POLA_HEX = new RegExp(`^[0-9a-fA-F]{${KUNCI_INDUK_BYTES * 2}}$`);

/**
 * Pesan hanya dari alasan tetap di bawah; isi kunci dan isi berkas tidak pernah
 * masuk ke pesan galat.
 */
export class KunciTidakValid extends Error {
  constructor(alasan: string) {
    super(`Kunci induk tidak valid: ${alasan}.`);
    this.name = "KunciTidakValid";
  }
}

/** Mengurai teks hex 64 karakter menjadi 32 byte; spasi dan newline di ujung dipangkas. */
export function parseKunciInduk(teks: string): Buffer {
  const hex = teks.trim();
  // Validasi SEBELUM Buffer.from: Buffer.from(..., "hex") diam-diam memotong di
  // karakter tidak valid, sehingga kunci rusak bisa menjadi kunci pendek yang lolos.
  if (!POLA_HEX.test(hex)) {
    throw new KunciTidakValid("harus 64 karakter hex");
  }
  return Buffer.from(hex, "hex");
}

/**
 * Membaca berkas kunci. Di POSIX, berkas yang bisa diakses grup atau pengguna lain
 * ditolak. Windows tidak punya bit izin POSIX (mode yang dilaporkan tidak berarti),
 * jadi pemeriksaan dilewati di sana.
 */
export async function bacaKunciInduk(lokasi: string | undefined): Promise<Buffer> {
  if (!lokasi) throw new KunciTidakValid("lokasi berkas belum diatur");

  let teks: string;
  try {
    if (process.platform !== "win32") {
      const { mode } = await stat(lokasi);
      if ((mode & 0o077) !== 0) {
        throw new KunciTidakValid("izin berkas terlalu longgar");
      }
    }
    teks = await readFile(lokasi, "utf8");
  } catch (error) {
    if (error instanceof KunciTidakValid) throw error;
    throw new KunciTidakValid("berkas tidak dapat dibaca");
  }
  return parseKunciInduk(teks);
}

/**
 * Membuat berkas kunci baru. Flag "wx" gagal bila berkas sudah ada, sehingga kunci
 * lama tidak pernah tertimpa (menimpa kunci membuat semua tag lama tidak bisa
 * diverifikasi). Mode 0o600: hanya pemilik yang boleh baca dan tulis (di POSIX).
 */
export async function buatBerkasKunci(lokasi: string): Promise<void> {
  const hex = randomBytes(KUNCI_INDUK_BYTES).toString("hex");
  await writeFile(lokasi, `${hex}\n`, { flag: "wx", mode: 0o600 });
}
