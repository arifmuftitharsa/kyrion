import { createHash, timingSafeEqual } from "node:crypto";

// Batas sama dengan batas unggah formulir (10 MB). Membatasi input mencegah
// server menghabiskan memori/CPU untuk berkas yang tidak wajar besarnya.
export const MAX_INPUT_BYTES = 10 * 1024 * 1024;

// Format sidik jari yang sah: tepat 64 karakter hex huruf kecil (SHA-256 = 32 byte).
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

export class InputTooLargeError extends Error {
  constructor(actualBytes: number) {
    super(
      `Ukuran input ${actualBytes} byte melebihi batas maksimum ${MAX_INPUT_BYTES} byte.`,
    );
    this.name = "InputTooLargeError";
  }
}

/**
 * Menghitung sidik jari SHA-256 dari data.
 *
 * Hasilnya ditulis dalam hex. Hex hanyalah encoding (cara menulis byte sebagai
 * teks), bukan enkripsi: tidak ada kunci dan tidak ada yang dirahasiakan.
 * Keamanannya berasal dari sifat SHA-256 yang satu arah dan tahan tabrakan.
 */
export function fingerprint(data: Uint8Array): string {
  // Ukuran dicek sebelum hashing agar input berlebih ditolak tanpa diproses.
  if (data.byteLength > MAX_INPUT_BYTES) {
    throw new InputTooLargeError(data.byteLength);
  }
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Memeriksa apakah sidik jari data sama dengan nilai yang diharapkan.
 * Melempar InputTooLargeError bila data melebihi MAX_INPUT_BYTES.
 */
export function verifyFingerprint(data: Uint8Array, expectedHex: string): boolean {
  // Validasi format SEBELUM Buffer.from: Buffer.from(..., "hex") diam-diam
  // mengabaikan karakter tidak valid dan memotong string, sehingga input rusak
  // bisa menghasilkan buffer yang tidak terduga. Format salah = gagal tertutup.
  if (!SHA256_HEX_PATTERN.test(expectedHex)) {
    return false;
  }

  const actual = Buffer.from(fingerprint(data), "hex");
  const expected = Buffer.from(expectedHex, "hex");

  // timingSafeEqual membandingkan dalam waktu konstan. Operator === berhenti
  // di karakter pertama yang berbeda, sehingga lama perbandingan bisa
  // membocorkan berapa banyak awalan yang cocok (timing attack).
  // Panjang kedua buffer dijamin sama (32 byte) oleh regex di atas.
  return timingSafeEqual(actual, expected);
}
