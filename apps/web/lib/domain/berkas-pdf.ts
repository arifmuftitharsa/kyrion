// Validasi berkas PDF unggahan (F-12): fungsi murni, tanpa akses disk atau DB.
// MIME dan ekstensi dari browser tidak dipercaya; bukti format adalah magic bytes.
// Impor relatif: Vitest berjalan tanpa config alias "@/".
// Modul ini juga dipakai Client Component, jadi hanya mengimpor ../crypto/batas
// (tanpa node:crypto), bukan fingerprint.ts.
import { MAX_INPUT_BYTES } from "../crypto/batas";

/** Lima byte pertama setiap berkas PDF yang sah. */
export const PDF_MAGIC = "%PDF-";

const PDF_MAGIC_BYTES = new TextEncoder().encode(PDF_MAGIC);
const MAX_MB = MAX_INPUT_BYTES / (1024 * 1024);

/** Galat ukuran; satu teks untuk pengecekan di klien dan di server. */
export const PESAN_UKURAN_MAKS = `Ukuran berkas maksimal ${MAX_MB} MB.`;

/** Apakah ukuran melebihi batas F-30 (10 MB). */
export function melebihiBatasUkuran(size: number): boolean {
  return size > MAX_INPUT_BYTES;
}
const PANJANG_NAMA_MAKS = 120;
const EKSTENSI = ".pdf";

function diawaliMagicPdf(awal: Uint8Array): boolean {
  return (
    awal.length >= PDF_MAGIC_BYTES.length &&
    PDF_MAGIC_BYTES.every((byte, i) => awal[i] === byte)
  );
}

/**
 * Nilai field "berkas" dari FormData menjadi File yang dipilih pengguna, atau null
 * bila tidak ada berkas dipilih. Input file kosong tiba sebagai File 0 byte; nama
 * "" pada parser web biasa, tetapi "undefined" pada Server Action Next (busboy
 * memberi filename undefined dan React memanggil new File([], undefined)).
 * File 0 byte dengan nama lain sengaja dipilih pengguna, jadi tetap dikembalikan
 * agar validasiBerkasPdf melaporkan "Berkas PDF kosong.".
 */
export function ambilBerkasOpsional(nilai: FormDataEntryValue | null): File | null {
  if (!(nilai instanceof File)) return null;
  // "undefined" (bukan hanya ""): busboy di Next mengembalikan filename undefined untuk
  // input file kosong, lalu React membuat new File([], undefined) sehingga name-nya "undefined".
  const tidakDipilih = nilai.size === 0 && (nilai.name === "" || nilai.name === "undefined");
  return tidakDipilih ? null : nilai;
}

/**
 * Pesan galat Bahasa Indonesia, atau undefined bila valid. Batas ukuran sama
 * dengan fungsi sidik F-30 (MAX_INPUT_BYTES). `awal` cukup beberapa byte pertama.
 */
export function validasiBerkasPdf(berkas: { size: number; awal: Uint8Array }): string | undefined {
  if (berkas.size === 0) return "Berkas PDF kosong.";
  if (melebihiBatasUkuran(berkas.size)) return PESAN_UKURAN_MAKS;
  if (!diawaliMagicPdf(berkas.awal)) return "Berkas bukan PDF yang valid.";
  return undefined;
}

/**
 * Nama tampilan yang aman: tanpa path, tanpa karakter kontrol atau tanda kutip,
 * maksimal 120 karakter, berakhiran .pdf. Tidak pernah dipakai sebagai path disk.
 */
export function sanitasiNamaBerkas(nama: string): string {
  const tanpaPath = nama.split(/[/\\]/).pop() ?? "";
  const bersih = tanpaPath
    .replace(/[\u0000-\u001f\u007f"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const dasar = bersih.replace(/\.pdf$/i, "").slice(0, PANJANG_NAMA_MAKS - EKSTENSI.length).trim();
  return `${dasar || "dokumen"}${EKSTENSI}`;
}
