import "server-only";
import { connection } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { CategoryNotFoundError } from "@/lib/domain/kategori";
import {
  RegulationHasVersionsError,
  RegulationNotFoundError,
  SlugTakenError,
} from "@/lib/domain/regulasi";
import { PERNAH_DISAHKAN } from "@/lib/domain/versi";
import { getPrisma } from "@/lib/prisma";
import type { MasukanRegulasi } from "@/lib/skema";
import type { BerkasTersimpan, Regulation } from "@/lib/types";

// Hanya versi yang pernah disahkan yang keluar dari lapisan data (F-02), agar
// DRAF dan DIBATALKAN tidak pernah terkirim ke halaman publik maupun browser.
// Urutan createdAt desc adalah tie-break untuk tanggal berlaku yang sama.
const withPublicVersions = {
  include: {
    category: { select: { name: true } },
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
    category: row.category.name,
    description: row.description,
    versions: row.versions.map((version) => ({
      id: version.id,
      versionNumber: version.versionNumber,
      // Kolom date dibaca sebagai 00.00 UTC, jadi bagian tanggal UTC selalu tepat.
      effectiveDate: version.effectiveDate.toISOString().slice(0, 10),
      status: version.status,
      changeSummary: version.changeSummary,
      fileSize: version.fileSize,
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

/**
 * Berkas versi untuk unduhan publik (F-05): hanya versi yang pernah disahkan
 * (SAH/DIGANTIKAN) milik regulasi `slug`. Draf dan Dibatalkan tidak pernah keluar.
 */
export async function findPublicVersionFile(
  slug: string,
  versionId: string,
): Promise<BerkasTersimpan | undefined> {
  const row = await getPrisma().version.findFirst({
    select: { fileKey: true, fileName: true, fileSha256: true },
    where: { id: versionId, regulation: { slug }, status: { in: [...PERNAH_DISAHKAN] } },
  });
  if (!row?.fileKey || !row.fileName || !row.fileSha256) return undefined;
  return { key: row.fileKey, name: row.fileName, sha256: row.fileSha256 };
}

/** Mengembalikan regulasi pada kategori (slug) tertentu; tanpa kategori berarti semua. */
export async function getRegulationsByCategory(
  categorySlug?: string,
): Promise<Regulation[]> {
  await connection();
  const rows = await getPrisma().regulation.findMany({
    ...withPublicVersions,
    where: categorySlug ? { category: { slug: categorySlug } } : {},
    orderBy: { name: "asc" },
  });
  return rows.map(toRegulation);
}

// ===================== Admin (Bagian B2) =====================

/** Ringkasan regulasi untuk admin; jumlah versi mencakup semua status. */
export interface AdminRegulation {
  id: string;
  slug: string;
  name: string;
  /** Nama kategori, untuk tampilan. */
  category: string;
  /** ID kategori, untuk nilai awal formulir ubah. */
  categoryId: string;
  description: string | null;
  versionCount: number;
}

const adminSelect = {
  id: true,
  slug: true,
  name: true,
  categoryId: true,
  category: { select: { name: true } },
  description: true,
  _count: { select: { versions: true } },
} satisfies Prisma.RegulationSelect;

type AdminRegulationRow = Prisma.RegulationGetPayload<{ select: typeof adminSelect }>;

function toAdminRegulation({ _count, category, ...row }: AdminRegulationRow): AdminRegulation {
  return { ...row, category: category.name, versionCount: _count.versions };
}

export async function getAdminRegulations(): Promise<AdminRegulation[]> {
  await connection();
  const rows = await getPrisma().regulation.findMany({
    select: adminSelect,
    orderBy: { name: "asc" },
  });
  return rows.map(toAdminRegulation);
}

export async function getAdminRegulationBySlug(
  slug: string,
): Promise<AdminRegulation | undefined> {
  await connection();
  const row = await getPrisma().regulation.findUnique({
    select: adminSelect,
    where: { slug },
  });
  return row ? toAdminRegulation(row) : undefined;
}

/** Dipakai Server Action untuk pra-cek; tanpa connection() karena di luar render. */
export async function getAdminRegulationById(
  id: string,
): Promise<AdminRegulation | undefined> {
  const row = await getPrisma().regulation.findUnique({
    select: adminSelect,
    where: { id },
  });
  return row ? toAdminRegulation(row) : undefined;
}

/** Validasi semantik: slug tidak boleh dipakai regulasi lain (kecuali dirinya). */
export async function isSlugTaken(slug: string, exceptId?: string): Promise<boolean> {
  const count = await getPrisma().regulation.count({
    where: { slug, ...(exceptId && { NOT: { id: exceptId } }) },
  });
  return count > 0;
}

/**
 * Menerjemahkan galat Prisma ke galat domain. Pra-cek di Server Action bisa
 * kalah balapan dengan request lain; constraint basis data adalah penjaga akhir.
 * P2003 bermakna berbeda per operasi, jadi pemanggil menentukan galatnya.
 */
function toDomainError(
  error: unknown,
  pelanggaranForeignKey: (cause: Error) => Error,
): unknown {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return error;
  switch (error.code) {
    // Satu-satunya kolom unik di regulations selain primary key adalah slug.
    case "P2002":
      return new SlugTakenError("Slug sudah dipakai", { cause: error });
    case "P2003":
      return pelanggaranForeignKey(error);
    case "P2025":
      return new RegulationNotFoundError("Regulasi tidak ditemukan", { cause: error });
    default:
      return error;
  }
}

// Saat simpan: FK kategori gagal berarti kategorinya dihapus setelah pra-cek.
const kategoriHilang = (cause: Error) =>
  new CategoryNotFoundError("Kategori tidak ditemukan", { cause });

// Saat hapus: ON DELETE RESTRICT (PG 23001) dipetakan adapter-pg ke P2003.
const masihPunyaVersi = (cause: Error) =>
  new RegulationHasVersionsError("Regulasi masih punya versi", { cause });

export async function createRegulation(
  masukan: MasukanRegulasi,
  slug: string,
): Promise<void> {
  try {
    await getPrisma().regulation.create({ data: { ...masukan, slug } });
  } catch (error) {
    throw toDomainError(error, kategoriHilang);
  }
}

export async function updateRegulation(
  id: string,
  masukan: MasukanRegulasi,
  slug: string,
): Promise<void> {
  try {
    await getPrisma().regulation.update({ where: { id }, data: { ...masukan, slug } });
  } catch (error) {
    throw toDomainError(error, kategoriHilang);
  }
}

export async function deleteRegulation(id: string): Promise<void> {
  try {
    await getPrisma().regulation.delete({ where: { id } });
  } catch (error) {
    throw toDomainError(error, masihPunyaVersi);
  }
}
