// DATA SINTETIS: seluruh regulasi dan versi di bawah ini fiktif, diturunkan
// dari data tiruan lib/data/regulations.ts, hanya untuk pengembangan.
import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type ChangeSource, type VersionStatus } from "../generated/prisma/client";
import { hashPassword } from "../lib/crypto/password";
import { createSlug } from "../lib/domain/slug";

loadEnvConfig(process.cwd());

interface SeedVersion {
  versionNumber: string;
  /** Tanggal ISO "YYYY-MM-DD"; new Date(iso) membacanya sebagai UTC. */
  effectiveDate: string;
  status: VersionStatus;
  changeSummary: string | null;
  /** Butir perubahan sintetis (F-04); hanya untuk versi SAH/DIGANTIKAN. */
  changes?: { description: string; source: ChangeSource; page: number | null }[];
}

// Slug tidak ditulis manual: selalu createSlug(name), sama dengan aplikasi,
// agar cek unik slug juga mendeteksi nama kembar.
interface SeedRegulation {
  name: string;
  description: string | null;
  /** Nama kategori; baris kategori dibuat dengan slug createSlug(nama). */
  category: string;
  versions: SeedVersion[];
}

const regulations: SeedRegulation[] = [
  {
    name: "Pedoman Akademik",
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
        changes: [
          { description: "[DATA SINTETIS] Batas maksimal SKS per semester dinaikkan dari 22 menjadi 24 SKS.", source: "CHANGELOG", page: 4 },
          { description: "[DATA SINTETIS] Syarat IPK untuk mengambil SKS maksimal diperjelas.", source: "PERBANDINGAN", page: 12 },
        ],
      },
      // Sah tetapi belum berlaku; versi 2025/2026 tetap Sah sampai tanggal ini.
      {
        versionNumber: "2027/2028",
        effectiveDate: "2027-08-01",
        status: "SAH",
        changeSummary: "Penambahan ketentuan rekognisi pembelajaran lampau.",
        changes: [
          { description: "[DATA SINTETIS] Bab baru tentang rekognisi pembelajaran lampau.", source: "CHANGELOG", page: 18 },
          { description: "[DATA SINTETIS] Definisi masa studi maksimal disesuaikan dengan ketentuan rekognisi.", source: "PERBANDINGAN", page: 7 },
        ],
      },
    ],
  },
  {
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
        changes: [
          { description: "[DATA SINTETIS] Jam operasional laboratorium diperpanjang sampai pukul 21.00.", source: "CHANGELOG", page: 9 },
          { description: "[DATA SINTETIS] Sanksi keterlambatan pengembalian peralatan dirinci ulang.", source: "PERBANDINGAN", page: null },
        ],
      },
    ],
  },
  {
    name: "Pedoman Tugas Akhir",
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
    name: "Pedoman Magang Mahasiswa",
    description: null,
    category: "Kemahasiswaan",
    versions: [],
  },
];

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// NIST SP 800-63B-4: minimal 15 karakter untuk kata sandi sebagai faktor tunggal.
const PANJANG_MINIMAL_SANDI = 15;

/**
 * Kredensial admin dari .env.local. Pesan galat sengaja tidak memuat nilai
 * apa pun (termasuk panjang kata sandi) agar rahasia tidak masuk log terminal.
 */
function bacaKredensialAdmin(): { email: string; password: string } {
  const email = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD;
  if (!email || !password) {
    throw new Error("ADMIN_SEED_EMAIL dan ADMIN_SEED_PASSWORD wajib diisi di apps/web/.env.local");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("ADMIN_SEED_EMAIL bukan alamat email yang valid");
  }
  if (password.length < PANJANG_MINIMAL_SANDI) {
    throw new Error(`ADMIN_SEED_PASSWORD minimal ${PANJANG_MINIMAL_SANDI} karakter (NIST SP 800-63B-4)`);
  }
  return { email, password };
}

/** Upsert akun Admin per email; kata sandi hanya disimpan sebagai hash scrypt. */
async function seedAdmin({ email, password }: { email: string; password: string }) {
  const passwordHash = await hashPassword(password);
  await prisma.user.upsert({
    where: { email },
    create: { email, role: "ADMIN", isActive: true, passwordHash },
    update: { role: "ADMIN", isActive: true, passwordHash },
  });
}

/** Upsert kategori per slug; mengembalikan peta slug ke id untuk regulasi. */
async function seedCategories(names: string[]): Promise<Map<string, string>> {
  const idBySlug = new Map<string, string>();
  for (const name of new Set(names)) {
    const slug = createSlug(name);
    const { id } = await prisma.category.upsert({
      where: { slug },
      create: { name, slug },
      update: { name },
    });
    idBySlug.set(slug, id);
  }
  return idBySlug;
}

/** Upsert berdasarkan kunci unik agar seed aman dijalankan berulang. */
async function seedRegulation(
  { name, description, versions }: SeedRegulation,
  categoryId: string,
) {
  const regulation = { name, description, slug: createSlug(name), categoryId };
  const { id: regulationId } = await prisma.regulation.upsert({
    where: { slug: regulation.slug },
    create: regulation,
    update: regulation,
  });

  for (const { changes, ...version } of versions) {
    const data = {
      ...version,
      effectiveDate: new Date(version.effectiveDate),
    };
    const { id: versionId } = await prisma.version.upsert({
      where: {
        regulationId_versionNumber: {
          regulationId,
          versionNumber: version.versionNumber,
        },
      },
      create: { ...data, regulationId },
      update: data,
    });
    // Tanpa kunci unik alami: kosongkan lalu isi ulang per versi seed (idempoten).
    // Aman karena versi seed bukan Draf, jadi Admin tidak bisa menambah Change di sana.
    if (changes) {
      await prisma.$transaction([
        prisma.change.deleteMany({ where: { versionId } }),
        prisma.change.createMany({ data: changes.map((c) => ({ ...c, versionId })) }),
      ]);
    }
  }
}

async function main() {
  // Divalidasi lebih dulu: bila env belum diisi, seed berhenti sebelum menulis apa pun.
  const kredensialAdmin = bacaKredensialAdmin();
  const idBySlug = await seedCategories(regulations.map((r) => r.category));
  for (const regulation of regulations) {
    const categoryId = idBySlug.get(createSlug(regulation.category));
    if (!categoryId) throw new Error(`Kategori seed tidak ditemukan: ${regulation.category}`);
    await seedRegulation(regulation, categoryId);
  }
  await seedAdmin(kredensialAdmin);
  console.log(`Seed selesai: ${idBySlug.size} kategori, ${regulations.length} regulasi, 1 akun admin.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
