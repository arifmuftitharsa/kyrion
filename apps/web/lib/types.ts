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
  versionNumber: string;
  /** Tanggal berlaku dalam format ISO "YYYY-MM-DD". */
  effectiveDate: string;
  status: VersionStatus;
  /** Null untuk versi pertama (tidak ada versi sebelumnya). */
  changeSummary: string | null;
}

export interface Regulation {
  slug: string;
  name: string;
  category: string;
  description: string | null;
  versions: Version[];
}