import "server-only";
import { connection } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { RegulationNotFoundError } from "@/lib/domain/regulasi";
import { VersionNotEditableError, VersionNumberTakenError } from "@/lib/domain/versi-admin";
import { getPrisma } from "@/lib/prisma";
import type { MasukanVersi } from "@/lib/skema";
import type { VersionStatus } from "@/lib/types";

// Repositori Version untuk admin: semua status (DRAF dan DIBATALKAN juga),
// berbeda dengan lib/data/regulations.ts yang hanya mengeluarkan versi publik.

export interface AdminVersion {
  id: string;
  versionNumber: string;
  /** Tanggal berlaku dalam format ISO "YYYY-MM-DD". */
  effectiveDate: string;
  status: VersionStatus;
  changeSummary: string | null;
}

const versionSelect = {
  id: true,
  versionNumber: true,
  effectiveDate: true,
  status: true,
  changeSummary: true,
} satisfies Prisma.VersionSelect;

type VersionRow = Prisma.VersionGetPayload<{ select: typeof versionSelect }>;

function toAdminVersion(row: VersionRow): AdminVersion {
  // Kolom date dibaca sebagai 00.00 UTC, jadi bagian tanggal UTC selalu tepat.
  return { ...row, effectiveDate: row.effectiveDate.toISOString().slice(0, 10) };
}

/** Data yang ditulis dari masukan form; tanggal ISO dibaca sebagai UTC. */
function toVersionData(masukan: MasukanVersi) {
  return { ...masukan, effectiveDate: new Date(masukan.effectiveDate) };
}

function toDomainError(error: unknown): unknown {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return error;
  switch (error.code) {
    // Satu-satunya constraint unik di versions selain primary key.
    case "P2002":
      return new VersionNumberTakenError("Nomor versi sudah dipakai", { cause: error });
    // regulationId tidak ada lagi (regulasi terhapus setelah pra-cek).
    case "P2003":
      return new RegulationNotFoundError("Regulasi tidak ditemukan", { cause: error });
    default:
      return error;
  }
}

export async function getAdminVersions(regulationId: string): Promise<AdminVersion[]> {
  await connection();
  const rows = await getPrisma().version.findMany({
    select: versionSelect,
    where: { regulationId },
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toAdminVersion);
}

/**
 * Versi hanya ditemukan bila milik regulasi tersebut, sehingga ID versi dari
 * regulasi lain lewat URL yang salah tidak pernah cocok. Tanpa connection()
 * agar bisa dipakai juga oleh Server Action; halaman pemanggil sudah dinamis.
 */
export async function findVersion(
  regulationId: string,
  versionId: string,
): Promise<AdminVersion | undefined> {
  const row = await getPrisma().version.findFirst({
    select: versionSelect,
    where: { id: versionId, regulationId },
  });
  return row ? toAdminVersion(row) : undefined;
}

/** Versi baru selalu berstatus DRAF (PRD 5.1). */
export async function createVersion(regulationId: string, masukan: MasukanVersi): Promise<void> {
  try {
    await getPrisma().version.create({
      data: { ...toVersionData(masukan), status: "DRAF", regulationId },
    });
  } catch (error) {
    throw toDomainError(error);
  }
}

/**
 * Ubah hanya bila status masih DRAF pada saat query: kondisi status di where
 * membuat cek dan tulis atomik (menutup TOCTOU setelah pra-cek di action).
 */
export async function updateDraftVersion(
  regulationId: string,
  versionId: string,
  masukan: MasukanVersi,
): Promise<void> {
  let count: number;
  try {
    ({ count } = await getPrisma().version.updateMany({
      where: { id: versionId, regulationId, status: "DRAF" },
      data: toVersionData(masukan),
    }));
  } catch (error) {
    throw toDomainError(error);
  }
  if (count === 0) throw new VersionNotEditableError("Versi tidak lagi berstatus DRAF");
}

/** Hapus hanya bila status masih DRAF pada saat query (atomik, lihat updateDraftVersion). */
export async function deleteDraftVersion(regulationId: string, versionId: string): Promise<void> {
  const { count } = await getPrisma().version.deleteMany({
    where: { id: versionId, regulationId, status: "DRAF" },
  });
  if (count === 0) throw new VersionNotEditableError("Versi tidak lagi berstatus DRAF");
}
