import { timingSafeEqual } from "node:crypto";
import { verifyFingerprint } from "./fingerprint";
import type { DataVersiTerlindung } from "./kanonis";
import { POLA_TAG, buatTagVersi } from "./mac";

// Pemeriksaan integritas saat unduh (F-31). Gagal tertutup: galat apa pun berarti
// berkas tidak boleh dikirim.

/** Pesan tetap: tidak memuat kunci, tag, data versi, maupun penyebab internal. */
export class IntegritasGagal extends Error {
  constructor() {
    super("Integritas versi gagal diverifikasi.");
    this.name = "IntegritasGagal";
  }
}

/**
 * Memeriksa dua hal, keduanya wajib lolos:
 * 1. isi berkas di disk cocok dengan `data.fileSha256` (F-30), dan
 * 2. tag cocok dengan HMAC atas ketujuh field. Hash di DB hanya bisa dipercaya
 *    karena ikut ditandatangani; tanpa langkah 2 penyerang DB cukup menimpa hash.
 *
 * Semua galat internal (format tag rusak, kunci salah panjang, field tidak sah,
 * input terlalu besar) dibungkus menjadi IntegritasGagal.
 */
export function periksaIntegritasVersi(args: {
  kunciInduk: Uint8Array;
  data: DataVersiTerlindung;
  tag: string | null;
  bytes: Uint8Array;
}): void {
  const { kunciInduk, data, tag, bytes } = args;
  try {
    // Format dicek dulu: tag kosong atau rusak ditolak tanpa menghitung apa pun,
    // dan panjang kedua sisi perbandingan di bawah dijamin sama.
    if (typeof tag !== "string" || !POLA_TAG.test(tag)) throw new IntegritasGagal();

    if (!verifyFingerprint(bytes, data.fileSha256)) throw new IntegritasGagal();

    const harapan = Buffer.from(buatTagVersi(kunciInduk, data));
    // Waktu konstan: === berhenti di karakter pertama yang beda dan bisa
    // membocorkan berapa banyak awalan tag yang benar.
    if (!timingSafeEqual(harapan, Buffer.from(tag))) throw new IntegritasGagal();
  } catch {
    throw new IntegritasGagal();
  }
}
