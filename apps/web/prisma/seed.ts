// DATA SINTETIS: seluruh regulasi dan versi di bawah ini fiktif, diturunkan
// dari data tiruan lib/data/regulations.ts, hanya untuk pengembangan.
import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type VersionStatus } from "../generated/prisma/client";

loadEnvConfig(process.cwd());

interface SeedVersion {
  versionNumber: string;
  /** Tanggal ISO "YYYY-MM-DD"; new Date(iso) membacanya sebagai UTC. */
  effectiveDate: string;
  status: VersionStatus;
  changeSummary: string | null;
}

interface SeedRegulation {
  slug: string;
  name: string;
  description: string | null;
  category: string;
  versions: SeedVersion[];
}

const regulations: SeedRegulation[] = [
  {
    slug: "pedoman-akademik",
    name: "Pedoman Akademik Program Sarjana",
    description:
      "[DATA SINTETIS] Aturan beban studi, penilaian, dan masa studi mahasiswa program sarjana.",
    category: "Akademik",
    versions: [
      {
        versionNumber: "2024/2025",
        effectiveDate: "2024-08-01",
        status: "DIGANTIKAN",
        changeSummary: null,
      },
      {
        versionNumber: "2025/2026",
        effectiveDate: "2025-08-01",
        status: "SAH",
        changeSummary: "Penyesuaian batas maksimal SKS per semester.",
      },
      // Sah tetapi belum berlaku; versi 2025/2026 tetap Sah sampai tanggal ini.
      {
        versionNumber: "2027/2028",
        effectiveDate: "2027-08-01",
        status: "SAH",
        changeSummary: "Penambahan ketentuan rekognisi pembelajaran lampau.",
      },
    ],
  },
  {
    slug: "tata-tertib-mahasiswa",
    name: "Tata Tertib Mahasiswa",
    description:
      "[DATA SINTETIS] Hak, kewajiban, dan sanksi bagi mahasiswa di lingkungan kampus.",
    category: "Kemahasiswaan",
    versions: [
      {
        versionNumber: "2022",
        effectiveDate: "2022-09-01",
        status: "DIGANTIKAN",
        changeSummary: null,
      },
      {
        versionNumber: "2024",
        effectiveDate: "2024-09-01",
        status: "SAH",
        changeSummary: "Pembaruan ketentuan penggunaan fasilitas kampus.",
      },
    ],
  },
  {
    slug: "pedoman-tugas-akhir",
    name: "Pedoman Penulisan Tugas Akhir",
    description:
      "[DATA SINTETIS] Format penulisan, alur bimbingan, dan syarat sidang tugas akhir.",
    category: "Akademik",
    versions: [
      {
        versionNumber: "11",
        effectiveDate: "2025-01-15",
        status: "SAH",
        changeSummary: null,
      },
      {
        versionNumber: "12",
        effectiveDate: "2026-01-15",
        status: "DIBATALKAN",
        changeSummary: "Usulan perubahan format sitasi yang dibatalkan.",
      },
      {
        versionNumber: "13",
        effectiveDate: "2027-01-15",
        status: "DRAF",
        changeSummary: "Rancangan penyesuaian alur bimbingan daring.",
      },
    ],
  },
  {
    // Sengaja tanpa versi dan tanpa deskripsi.
    slug: "pedoman-magang-mahasiswa",
    name: "Pedoman Magang Mahasiswa",
    description: null,
    category: "Kemahasiswaan",
    versions: [],
  },
];

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Upsert berdasarkan kunci unik agar seed aman dijalankan berulang. */
async function seedRegulation({ versions, ...regulation }: SeedRegulation) {
  const { id: regulationId } = await prisma.regulation.upsert({
    where: { slug: regulation.slug },
    create: regulation,
    update: regulation,
  });

  for (const version of versions) {
    const data = {
      ...version,
      effectiveDate: new Date(version.effectiveDate),
    };
    await prisma.version.upsert({
      where: {
        regulationId_versionNumber: {
          regulationId,
          versionNumber: version.versionNumber,
        },
      },
      create: { ...data, regulationId },
      update: data,
    });
  }
}

async function main() {
  for (const regulation of regulations) {
    await seedRegulation(regulation);
  }
  console.log(`Seed selesai: ${regulations.length} regulasi.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
