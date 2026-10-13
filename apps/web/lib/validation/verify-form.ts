// Validasi dipisahkan dari komponen React agar berupa fungsi murni:
// input sama selalu menghasilkan output sama, sehingga mudah diuji unit
// dan bisa dipakai ulang (mis. di server pada versi berikutnya).

export const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const PDF_MIME_TYPE = "application/pdf";

/** Hanya properti berkas yang dibutuhkan; memudahkan membuat data uji tanpa objek File asli. */
export type FileLike = Pick<File, "name" | "type" | "size">;

export interface VerifyFormValues {
  regulationSlug: string;
  versionNumber: string;
  file: FileLike | null;
}

export type VerifyFormErrors = Partial<Record<keyof VerifyFormValues, string>>;

/**
 * Sebagian browser/OS tidak mengisi `type` berkas, sehingga ekstensi .pdf
 * diterima sebagai cadangan.
 */
export function isPdfFile(file: FileLike): boolean {
  return file.type === PDF_MIME_TYPE || file.name.toLowerCase().endsWith(".pdf");
}

function validateFile(file: FileLike | null): string | undefined {
  if (!file) return "Dokumen PDF wajib diunggah.";
  if (!isPdfFile(file)) return "Berkas harus berformat PDF.";
  if (file.size > MAX_SIZE_BYTES) {
    return `Ukuran berkas maksimal ${MAX_SIZE_MB} MB.`;
  }
  return undefined;
}

/** Mengembalikan pesan galat per field; objek kosong berarti form valid. */
export function validateVerifyForm(values: VerifyFormValues): VerifyFormErrors {
  const errors: VerifyFormErrors = {};

  if (!values.regulationSlug) errors.regulationSlug = "Regulasi wajib dipilih.";
  if (!values.versionNumber) errors.versionNumber = "Versi wajib dipilih.";

  const fileError = validateFile(values.file);
  if (fileError) errors.file = fileError;

  return errors;
}

export function hasErrors(errors: VerifyFormErrors): boolean {
  return Object.keys(errors).length > 0;
}
