import type { DataVersiTerlindung } from "./kanonis";

// Pemetaan baris versi ke data yang ditandatangani (F-31). Murni dan struktural:
// tidak mengimpor Prisma, sehingga bisa diuji tanpa DB dan dipakai di jalur tulis
// (nilai yang akan ditulis) maupun jalur baca (nilai yang dibaca kembali).

export interface BarisVersi {
  id: string;
  regulationId: string;
  versionNumber: string;
  effectiveDate: Date | string;
  fileSha256: string | null;
  fileName: string | null;
  fileSize: number | null;
}

/**
 * Tanggal "YYYY-MM-DD" dengan basis UTC. Kolom date dibaca Prisma sebagai 00.00 UTC,
 * jadi bagian tanggal UTC selalu tepat; basis lokal bisa menggeser tanggal sehari.
 * Melempar RangeError bila tanggal tidak dapat dibaca.
 */
function tanggalIso(tanggal: Date | string): string {
  const nilai = typeof tanggal === "string" ? new Date(tanggal) : tanggal;
  return nilai.toISOString().slice(0, 10);
}

/**
 * Data terlindung dari sebuah baris versi; null bila versi belum punya berkas
 * lengkap (versi tanpa berkas tidak bertag). Sengaja `=== null`: fileSize 0
 * adalah nilai sah, bukan kosong.
 */
export function dataTerlindungDariBaris(baris: BarisVersi): DataVersiTerlindung | null {
  const { fileSha256, fileName, fileSize } = baris;
  if (fileSha256 === null || fileName === null || fileSize === null) return null;
  return {
    id: baris.id,
    regulationId: baris.regulationId,
    versionNumber: baris.versionNumber,
    effectiveDate: tanggalIso(baris.effectiveDate),
    fileSha256,
    fileName,
    fileSize,
  };
}
