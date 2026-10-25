import "server-only";
import { connection } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import type { VersiBanding } from "@/lib/domain/banding";
import { ChangeNotFoundError } from "@/lib/domain/perubahan";
import { PERNAH_DISAHKAN } from "@/lib/domain/versi";
import { VersionNotEditableError } from "@/lib/domain/versi-admin";
import { getPrisma } from "@/lib/prisma";
import type { MasukanPerubahan } from "@/lib/skema";
import type { ChangeSource } from "@/lib/types";

// Repositori Change (F-04). Admin membaca/menulis hanya lewat versi DRAF; publik
// hanya membaca Change milik versi yang pernah disahkan.

export interface AdminChange {
  id: string;
  description: string;
  source: ChangeSource;
  page: number | null;
}

const changeSelect = {
  id: true,
  description: true,
  source: true,
  page: true,
} satisfies Prisma.ChangeSelect;

// Urutan tampil: waktu dibuat, id (UUIDv7, terurut waktu) sebagai tie-break.
const urutan = [{ createdAt: "asc" }, { id: "asc" }] satisfies Prisma.ChangeOrderByWithRelationInput[];

export async function getAdminChanges(versionId: string): Promise<AdminChange[]> {
  await connection();
  return getPrisma().change.findMany({ select: changeSelect, where: { versionId }, orderBy: urutan });
}

/** Change hanya ditemukan bila milik versi tersebut. Tanpa connection(): dipakai juga oleh Server Action. */
export async function findChange(versionId: string, changeId: string): Promise<AdminChange | undefined> {
  const row = await getPrisma().change.findFirst({
    select: changeSelect,
    where: { id: changeId, versionId },
  });
  return row ?? undefined;
}

/**
 * Versi yang pernah disahkan milik regulasi `slug` beserta Change-nya, untuk halaman
 * perbandingan publik. Draf dan Dibatalkan tidak pernah keluar dari sini.
 */
export async function getPublicVersionsForComparison(slug: string): Promise<VersiBanding[]> {
  await connection();
  const rows = await getPrisma().version.findMany({
    select: {
      id: true,
      versionNumber: true,
      effectiveDate: true,
      status: true,
      changes: { select: changeSelect, orderBy: urutan },
    },
    where: { regulation: { slug }, status: { in: [...PERNAH_DISAHKAN] } },
    orderBy: [{ effectiveDate: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(({ changes, effectiveDate, ...row }) => ({
    ...row,
    // Kolom date dibaca sebagai 00.00 UTC, jadi bagian tanggal UTC selalu tepat.
    effectiveDate: effectiveDate.toISOString().slice(0, 10),
    perubahan: changes,
  }));
}

/**
 * Menjalankan `tulis` hanya bila versi masih DRAF dan milik regulasi tersebut. UPDATE
 * pada baris versi mengunci baris itu sampai commit, sehingga pengesahan (v0.3) tidak
 * bisa menyelip di antara cek status dan tulis Change. Filter relasi di where Change
 * saja tidak cukup: itu dijalankan sebagai baca lalu tulis tanpa mengunci induk.
 */
async function denganVersiDraf<T>(
  regulationId: string,
  versionId: string,
  tulis: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  try {
    return await getPrisma().$transaction(async (tx) => {
      const { count } = await tx.version.updateMany({
        where: { id: versionId, regulationId, status: "DRAF" },
        data: { updatedAt: new Date() },
      });
      if (count === 0) throw new VersionNotEditableError("Versi tidak lagi berstatus DRAF");
      return tulis(tx);
    });
  } catch (error) {
    // P2003: versi terhapus di antara kunci dan insert; sama maknanya dengan tidak lagi Draf.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      throw new VersionNotEditableError("Versi tidak lagi berstatus DRAF", { cause: error });
    }
    throw error;
  }
}

export async function createChange(
  regulationId: string,
  versionId: string,
  masukan: MasukanPerubahan,
): Promise<void> {
  await denganVersiDraf(regulationId, versionId, (tx) =>
    tx.change.create({ data: { ...masukan, versionId } }),
  );
}

export async function updateChange(
  regulationId: string,
  versionId: string,
  changeId: string,
  masukan: MasukanPerubahan,
): Promise<void> {
  const { count } = await denganVersiDraf(regulationId, versionId, (tx) =>
    tx.change.updateMany({ where: { id: changeId, versionId }, data: masukan }),
  );
  if (count === 0) throw new ChangeNotFoundError("Perubahan tidak ditemukan");
}

export async function deleteChange(
  regulationId: string,
  versionId: string,
  changeId: string,
): Promise<void> {
  const { count } = await denganVersiDraf(regulationId, versionId, (tx) =>
    tx.change.deleteMany({ where: { id: changeId, versionId } }),
  );
  if (count === 0) throw new ChangeNotFoundError("Perubahan tidak ditemukan");
}
