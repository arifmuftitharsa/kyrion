import type { Regulation, Version } from "@/lib/types";

// DATA SINTETIS: seluruh regulasi di bawah ini fiktif dan hanya dipakai
// untuk demo antarmuka v0.1. Belum ada backend maupun database.
const regulations: Regulation[] = [
  {
    slug: "pedoman-akademik",
    name: "Pedoman Akademik Program Sarjana",
    category: "Akademik",
    description:
      "Aturan beban studi, penilaian, dan masa studi mahasiswa program sarjana.",
    versions: [
      {
        versionNumber: "1.0",
        effectiveDate: "2023-08-01",
        status: "Digantikan",
        changeSummary: "Penetapan awal pedoman akademik.",
      },
      {
        versionNumber: "1.1",
        effectiveDate: "2024-02-01",
        status: "Digantikan",
        changeSummary: "Penyesuaian batas maksimal SKS per semester.",
      },
      {
        versionNumber: "2.0",
        effectiveDate: "2025-08-01",
        status: "Sah",
        changeSummary: "Penambahan ketentuan rekognisi pembelajaran lampau.",
      },
    ],
  },
  {
    slug: "tata-tertib-mahasiswa",
    name: "Tata Tertib Mahasiswa",
    category: "Kemahasiswaan",
    description:
      "Hak, kewajiban, dan sanksi bagi mahasiswa di lingkungan kampus.",
    versions: [
      {
        versionNumber: "1.0",
        effectiveDate: "2022-09-01",
        status: "Digantikan",
        changeSummary: "Penetapan awal tata tertib.",
      },
      {
        versionNumber: "1.1",
        effectiveDate: "2024-09-01",
        status: "Sah",
        changeSummary: "Pembaruan ketentuan penggunaan fasilitas kampus.",
      },
    ],
  },
  {
    slug: "pedoman-tugas-akhir",
    name: "Pedoman Penulisan Tugas Akhir",
    category: "Akademik",
    description:
      "Format penulisan, alur bimbingan, dan syarat sidang tugas akhir.",
    versions: [
      {
        versionNumber: "1.0",
        effectiveDate: "2025-01-15",
        status: "Sah",
        changeSummary: "Penetapan awal pedoman tugas akhir.",
      },
    ],
  },
];

export function getRegulations(): Regulation[] {
  return regulations;
}

export function getRegulationBySlug(slug: string): Regulation | undefined {
  return regulations.find((regulation) => regulation.slug === slug);
}

/** Mengembalikan regulasi pada kategori tertentu; tanpa kategori berarti semua. */
export function getRegulationsByCategory(category?: string): Regulation[] {
  if (!category) return regulations;
  return regulations.filter((regulation) => regulation.category === category);
}

/** Versi berlaku adalah satu-satunya versi berstatus "Sah". */
export function getCurrentVersion(regulation: Regulation): Version | undefined {
  return regulation.versions.find((version) => version.status === "Sah");
}

/** Daftar kategori unik; Set dipakai agar kategori tidak muncul ganda di filter. */
export function getCategories(): string[] {
  return [...new Set(regulations.map((regulation) => regulation.category))];
}

/**
 * Mengurutkan versi dari yang terbaru. Membuat salinan array agar data
 * sumber tidak ikut berubah (fungsi murni). Perbandingan string aman
 * karena format ISO "YYYY-MM-DD" terurut secara leksikografis.
 */
export function sortVersionsNewestFirst(versions: Version[]): Version[] {
  return [...versions].sort((a, b) =>
    b.effectiveDate.localeCompare(a.effectiveDate),
  );
}
