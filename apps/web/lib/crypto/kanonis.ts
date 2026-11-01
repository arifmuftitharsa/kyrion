// Bentuk byte kanonis catatan versi untuk F-31. Hanya mengubah data menjadi byte
// yang tetap dan tidak ambigu; tidak ada kunci dan tidak ada kriptografi di sini.
// JSON.stringify sengaja tidak dipakai: urutan kunci dan escape-nya bukan jaminan
// format, sehingga dua sisi bisa menghasilkan byte berbeda untuk data yang sama.

export const LABEL_KANONIS = "kyrion:version:v1";

/** Tujuh field versi yang dilindungi tag. Status dan updated_at sengaja tidak termasuk. */
export interface DataVersiTerlindung {
  id: string;
  regulationId: string;
  versionNumber: string;
  /** Tanggal berlaku "YYYY-MM-DD". */
  effectiveDate: string;
  /** SHA-256 berkas: 64 karakter hex huruf kecil. */
  fileSha256: string;
  fileName: string;
  fileSize: number;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;
const TANGGAL_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function tanggalSah(teks: string): boolean {
  if (!TANGGAL_PATTERN.test(teks)) return false;
  const tanggal = new Date(`${teks}T00:00:00Z`);
  // Tanggal mustahil (30 Februari) menghasilkan Invalid Date; round-trip menangkap sisanya.
  return !Number.isNaN(tanggal.getTime()) && tanggal.toISOString().slice(0, 10) === teks;
}

/** Pesan hanya menyebut nama field, tidak pernah nilainya. */
function wajib(sah: boolean, nama: keyof DataVersiTerlindung): void {
  if (!sah) throw new RangeError(`Field tidak sah: ${nama}`);
}

/**
 * Satu bagian: panjang 4 byte big-endian lalu isi UTF-8. Awalan panjang membuat
 * batas antarfield tegas, sehingga "ab"+"c" dan "a"+"bc" tidak pernah sama.
 * NFC menyamakan "é" tunggal dengan "e" + aksen terpisah.
 */
function bagian(teks: string): Buffer {
  const isi = Buffer.from(teks.normalize("NFC"), "utf8");
  const panjang = Buffer.alloc(4);
  panjang.writeUInt32BE(isi.length);
  return Buffer.concat([panjang, isi]);
}

/**
 * Label lalu ketujuh field dengan urutan tetap, masing-masing sebagai satu bagian.
 * Angka ditulis sebagai desimal teks. Melempar RangeError bila ada field yang
 * bentuknya tidak sah; urutan di bawah adalah bagian dari format v1.
 */
export function kanonisasiVersi(data: DataVersiTerlindung): Buffer {
  wajib(UUID_PATTERN.test(data.id), "id");
  wajib(UUID_PATTERN.test(data.regulationId), "regulationId");
  // String dengan surrogate yatim diam-diam menjadi U+FFFD di UTF-8, sehingga dua
  // nilai berbeda bisa menghasilkan byte sama. Ditolak agar pemetaan tetap satu-satu.
  wajib(data.versionNumber.isWellFormed(), "versionNumber");
  wajib(tanggalSah(data.effectiveDate), "effectiveDate");
  wajib(SHA256_HEX_PATTERN.test(data.fileSha256), "fileSha256");
  wajib(data.fileName.isWellFormed(), "fileName");
  wajib(Number.isSafeInteger(data.fileSize) && data.fileSize >= 0, "fileSize");

  return Buffer.concat(
    [
      LABEL_KANONIS,
      data.id,
      data.regulationId,
      data.versionNumber,
      data.effectiveDate,
      data.fileSha256,
      data.fileName,
      String(data.fileSize),
    ].map(bagian),
  );
}
