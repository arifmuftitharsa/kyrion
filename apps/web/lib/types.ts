// Tipe domain dipusatkan di satu file agar data, komponen, dan halaman
// memakai kontrak yang sama (satu sumber kebenaran).

// Daftar kategori sementara (data tiruan). Pindah ke tabel database di Modul 6,
// karena kategori dikelola admin (PRD F-10).
export const KATEGORI = ["Akademik", "Kemahasiswaan"] as const;

export type Kategori = (typeof KATEGORI)[number];

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
  category: Kategori;
  description: string;
  versions: Version[];
}