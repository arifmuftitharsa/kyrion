// Tipe domain dipusatkan di satu file agar data, komponen, dan halaman
// memakai kontrak yang sama (satu sumber kebenaran).

/** Sama dengan enum version_status di database; label tampilan di VERSION_STATUS_LABEL. */
export type VersionStatus = "DRAF" | "SAH" | "DIGANTIKAN" | "DIBATALKAN";

/** Label tampilan status versi; satu sumber untuk semua komponen. */
export const VERSION_STATUS_LABEL: Record<VersionStatus, string> = {
  DRAF: "Draf",
  SAH: "Sah",
  DIGANTIKAN: "Digantikan",
  DIBATALKAN: "Dibatalkan",
};

export interface Version {
  id: string;
  versionNumber: string;
  /** Tanggal berlaku dalam format ISO "YYYY-MM-DD". */
  effectiveDate: string;
  status: VersionStatus;
  /** Ukuran berkas PDF dalam byte; null bila versi belum punya berkas. */
  fileSize: number | null;
}

/**
 * Berkas PDF versi yang tersimpan, untuk diunduh. Selain kunci disk, nama tampilan,
 * dan SHA-256, memuat seluruh field yang ikut ditandatangani (F-31) beserta tag-nya,
 * agar tag bisa diverifikasi sebelum berkas dikirim.
 */
export interface BerkasTersimpan {
  id: string;
  regulationId: string;
  versionNumber: string;
  /** Tanggal berlaku dalam format ISO "YYYY-MM-DD". */
  effectiveDate: string;
  key: string;
  name: string;
  /** Ukuran berkas dalam byte. */
  size: number;
  sha256: string;
  /** Tag integritas "v1$<hex64>"; null untuk baris yang belum ditandatangani (ditolak saat unduh). */
  tag: string | null;
}

export interface Regulation {
  slug: string;
  name: string;
  category: string;
  description: string | null;
  versions: Version[];
}

/** Sama dengan enum change_source di database. */
export type ChangeSource = "CHANGELOG" | "PERBANDINGAN";

/** Label tampilan sumber perubahan; satu sumber untuk admin dan halaman publik. */
export const SUMBER_PERUBAHAN_LABEL: Record<ChangeSource, string> = {
  CHANGELOG: "Changelog",
  PERBANDINGAN: "Perbandingan",
};
