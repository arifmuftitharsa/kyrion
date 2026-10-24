import "server-only";
import { connection } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { PERNAH_DISAHKAN } from "@/lib/domain/versi";
import { getPrisma } from "@/lib/prisma";
import type { Regulation } from "@/lib/types";
import type { MasukanRegulasi } from "@/lib/skema"; // BARU (Modul 5)

// Hanya versi yang pernah disahkan yang keluar dari lapisan data (F-02), agar
// DRAF dan DIBATALKAN tidak pernah terkirim ke halaman publik maupun browser.
// Urutan createdAt desc adalah tie-break untuk tanggal berlaku yang sama.
const withPublicVersions = {
  include: {
    versions: {
      where: { status: { in: [...PERNAH_DISAHKAN] } },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
    },
  },
} satisfies Prisma.RegulationDefaultArgs;

type RegulationRow = Prisma.RegulationGetPayload<typeof withPublicVersions>;

/** Memetakan baris Prisma ke tipe domain; komponen tidak pernah melihat tipe Prisma. */
function toRegulation(row: RegulationRow): Regulation {
  return {
    slug: row.slug,
    name: row.name,
    category: row.category,
    description: row.description,
    versions: row.versions.map((version) => ({
      versionNumber: version.versionNumber,
      // Kolom date dibaca sebagai 00.00 UTC, jadi bagian tanggal UTC selalu tepat.
      effectiveDate: version.effectiveDate.toISOString().slice(0, 10),
      status: version.status,
      changeSummary: version.changeSummary,
    })),
  };
}

// connection(): halaman yang membaca database dirender saat request, bukan
// saat build, sehingga build tidak butuh database dan data selalu terbaru.

export async function getRegulations(): Promise<Regulation[]> {
  await connection();
  const rows = await getPrisma().regulation.findMany({
    ...withPublicVersions,
    orderBy: { name: "asc" },
  });
  return rows.map(toRegulation);
}

export async function getRegulationBySlug(
  slug: string,
): Promise<Regulation | undefined> {
  await connection();
  const row = await getPrisma().regulation.findUnique({
    ...withPublicVersions,
    where: { slug },
  });
  return row ? toRegulation(row) : undefined;
}

/** Mengembalikan regulasi pada kategori tertentu; tanpa kategori berarti semua. */
export async function getRegulationsByCategory(
  category?: string,
): Promise<Regulation[]> {
  await connection();
  const rows = await getPrisma().regulation.findMany({
    ...withPublicVersions,
    where: category ? { category } : {},
    orderBy: { name: "asc" },
  });
  return rows.map(toRegulation);
}

/** Daftar kategori unik yang dipakai regulasi, urut abjad. */
export async function getCategories(): Promise<string[]> {
  await connection();
  const rows = await getPrisma().regulation.findMany({
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
  });
  return rows.map((row) => row.category);
}

// ===================== BARU (Modul 5) =====================

// shortcut: array memori hanya agar isSlugTaken/addRegulation tetap terkompilasi;
// formulir tidak menyimpan ke database, diganti Prisma di Bagian B2.
const regulations: Regulation[] = [];

/** Ubah nama menjadi slug URL: huruf kecil, tanpa aksen, selain huruf/angka jadi "-". */
export function createSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Validasi semantik: slug tidak boleh sama dengan regulasi lain. */
export function isSlugTaken(slug: string): boolean {
  return regulations.some((regulation) => regulation.slug === slug);
}

/**
 * Mutasi data tiruan di memori. Data kembali ke isi awal saat server
 * dimulai ulang; diganti PostgreSQL + Prisma di Modul 6.
 */
export function addRegulation(masukan: MasukanRegulasi): Regulation {
  const regulation: Regulation = {
    slug: createSlug(masukan.name),
    ...masukan,
    versions: [],
  };
  regulations.push(regulation);
  return regulation;
}
