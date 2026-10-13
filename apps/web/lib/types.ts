// Tipe domain dipusatkan di satu file agar data, komponen, dan halaman
// memakai kontrak yang sama (satu sumber kebenaran).

export type VersionStatus = "Sah" | "Digantikan";

export interface Version {
  versionNumber: string;
  /** Tanggal berlaku dalam format ISO "YYYY-MM-DD". */
  effectiveDate: string;
  status: VersionStatus;
  changeSummary: string;
}

export interface Regulation {
  slug: string;
  name: string;
  category: string;
  description: string;
  versions: Version[];
}
