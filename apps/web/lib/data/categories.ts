import "server-only";
import { connection } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import {
  CategoryHasRegulationsError,
  CategoryNotFoundError,
  CategorySlugTakenError,
} from "@/lib/domain/kategori";
import { getPrisma } from "@/lib/prisma";

// Repositori kategori (PRD F-10). Galat Prisma diterjemahkan ke galat domain
// sehingga Server Action tidak bergantung pada tipe Prisma.

export interface PublicCategory {
  slug: string;
  name: string;
}

export interface CategoryOption {
  id: string;
  name: string;
}

export interface AdminCategory {
  id: string;
  slug: string;
  name: string;
  regulationCount: number;
}

const adminSelect = {
  id: true,
  slug: true,
  name: true,
  _count: { select: { regulations: true } },
} satisfies Prisma.CategorySelect;

type AdminCategoryRow = Prisma.CategoryGetPayload<{ select: typeof adminSelect }>;

function toAdminCategory({ _count, ...row }: AdminCategoryRow): AdminCategory {
  return { ...row, regulationCount: _count.regulations };
}

/** Kategori untuk filter beranda: hanya yang punya regulasi, urut nama. */
export async function getPublicCategories(): Promise<PublicCategory[]> {
  await connection();
  return getPrisma().category.findMany({
    select: { slug: true, name: true },
    where: { regulations: { some: {} } },
    orderBy: { name: "asc" },
  });
}

/** Semua kategori untuk pilihan di formulir regulasi. */
export async function getCategoryOptions(): Promise<CategoryOption[]> {
  await connection();
  return getPrisma().category.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function getAdminCategories(): Promise<AdminCategory[]> {
  await connection();
  const rows = await getPrisma().category.findMany({
    select: adminSelect,
    orderBy: { name: "asc" },
  });
  return rows.map(toAdminCategory);
}

export async function getAdminCategoryBySlug(slug: string): Promise<AdminCategory | undefined> {
  await connection();
  const row = await getPrisma().category.findUnique({ select: adminSelect, where: { slug } });
  return row ? toAdminCategory(row) : undefined;
}

/** Dipakai Server Action untuk pra-cek; tanpa connection() karena di luar render. */
export async function findCategoryById(id: string): Promise<AdminCategory | undefined> {
  const row = await getPrisma().category.findUnique({ select: adminSelect, where: { id } });
  return row ? toAdminCategory(row) : undefined;
}

/** Validasi semantik: slug tidak boleh dipakai kategori lain (kecuali dirinya). */
export async function isCategorySlugTaken(slug: string, exceptId?: string): Promise<boolean> {
  const count = await getPrisma().category.count({
    where: { slug, ...(exceptId && { NOT: { id: exceptId } }) },
  });
  return count > 0;
}

function toDomainError(error: unknown): unknown {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return error;
  switch (error.code) {
    // Satu-satunya kolom unik di categories selain primary key adalah slug.
    case "P2002":
      return new CategorySlugTakenError("Slug kategori sudah dipakai", { cause: error });
    // ON DELETE RESTRICT (PG 23001) dipetakan adapter-pg ke P2003.
    case "P2003":
      return new CategoryHasRegulationsError("Kategori masih dipakai regulasi", { cause: error });
    case "P2025":
      return new CategoryNotFoundError("Kategori tidak ditemukan", { cause: error });
    default:
      return error;
  }
}

export async function createCategory(name: string, slug: string): Promise<void> {
  try {
    await getPrisma().category.create({ data: { name, slug } });
  } catch (error) {
    throw toDomainError(error);
  }
}

/** Slug ikut nama agar aturan nama mirip tetap berlaku setelah ganti nama. */
export async function renameCategory(id: string, name: string, slug: string): Promise<void> {
  try {
    await getPrisma().category.update({ where: { id }, data: { name, slug } });
  } catch (error) {
    throw toDomainError(error);
  }
}

/**
 * Hapus hanya bila kategori masih kosong pada saat query. Bila regulasi baru
 * masuk di tengah jalan, FK Restrict menolak (P2003) sebagai lapis kedua.
 */
export async function deleteEmptyCategory(id: string): Promise<void> {
  let count: number;
  try {
    ({ count } = await getPrisma().category.deleteMany({
      where: { id, regulations: { none: {} } },
    }));
  } catch (error) {
    throw toDomainError(error);
  }
  if (count > 0) return;
  // Tidak ada baris terhapus: bedakan "tidak ada" dari "masih dipakai".
  const terbaru = await findCategoryById(id);
  throw terbaru
    ? new CategoryHasRegulationsError("Kategori masih dipakai regulasi")
    : new CategoryNotFoundError("Kategori tidak ditemukan");
}
