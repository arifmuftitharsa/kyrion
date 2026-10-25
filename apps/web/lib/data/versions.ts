import "server-only";
import { connection } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { RegulationNotFoundError } from "@/lib/domain/regulasi";
import { VersionNotEditableError, VersionNumberTakenError } from "@/lib/domain/versi-admin";
import { getPrisma } from "@/lib/prisma";
import type { MasukanVersi } from "@/lib/skema";
import type { BerkasTersimpan, VersionStatus } from "@/lib/types";

// Repositori Version untuk admin: semua status (DRAF dan DIBATALKAN juga),
// berbeda dengan lib/data/regulations.ts yang hanya mengeluarkan versi publik.

export interface AdminVersion {
  id: string;
  versionNumber: string;
  /** Tanggal berlaku dalam format ISO "YYYY-MM-DD". */
  effectiveDate: string;
  status: VersionStatus;
  changeSummary: string | null;
  /** Kunci berkas di disk; null bila belum ada berkas. Dipakai kondisi tulis atomik. */
  fileKey: string | null;
  fileName: string | null;
  fileSize: number | null;
  /** Jumlah butir perubahan (F-04). */
  changeCount: number;
}

/** Berkas yang baru disimpan ke disk, siap dicatat di DB. */
export interface DataBerkas {
  key: string;
  name: string;
  size: number;
  sha256: string;
}

const versionSelect = {
  id: true,
  versionNumber: true,
  effectiveDate: true,
  status: true,
  changeSummary: true,
  fileKey: true,
  fileName: true,
  fileSize: true,
  _count: { select: { changes: true } },
} satisfies Prisma.VersionSelect;

/** Kelima kolom berkas selalu ditulis bersama. */
function toFileData(berkas: DataBerkas) {
  return {
    fileKey: berkas.key,
    fileName: berkas.name,
    fileSize: berkas.size,
    fileSha256: berkas.sha256,
    fileUploadedAt: new Date(),
  };
}

type VersionRow = Prisma.VersionGetPayload<{ select: typeof versionSelect }>;

function toAdminVersion(row: VersionRow): AdminVersion {
  const { _count, ...kolom } = row;
  // Kolom date dibaca sebagai 00.00 UTC, jadi bagian tanggal UTC selalu tepat.
  return { ...kolom, effectiveDate: row.effectiveDate.toISOString().slice(0, 10), changeCount: _count.changes };
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

/** Berkas versi untuk unduhan admin (semua status); undefined bila tidak ada berkas. */
export async function findVersionFile(
  regulationId: string,
  versionId: string,
): Promise<BerkasTersimpan | undefined> {
  const row = await getPrisma().version.findFirst({
    select: { fileKey: true, fileName: true, fileSha256: true },
    where: { id: versionId, regulationId },
  });
  if (!row?.fileKey || !row.fileName || !row.fileSha256) return undefined;
  return { key: row.fileKey, name: row.fileName, sha256: row.fileSha256 };
}

/** Versi baru selalu berstatus DRAF (PRD 5.1); berkas opsional ditulis dalam insert yang sama. */
export async function createVersion(
  regulationId: string,
  masukan: MasukanVersi,
  berkas?: DataBerkas,
): Promise<void> {
  try {
    await getPrisma().version.create({
      data: {
        ...toVersionData(masukan),
        ...(berkas && toFileData(berkas)),
        status: "DRAF",
        regulationId,
      },
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
  // Bila ada berkas baru: hanya berhasil bila berkas lama masih keyLama (cegah balapan ganti berkas).
  berkas?: { baru: DataBerkas; keyLama: string | null },
): Promise<void> {
  let count: number;
  try {
    ({ count } = await getPrisma().version.updateMany({
      where: {
        id: versionId,
        regulationId,
        status: "DRAF",
        ...(berkas && { fileKey: berkas.keyLama }),
      },
      data: { ...toVersionData(masukan), ...(berkas && toFileData(berkas.baru)) },
    }));
  } catch (error) {
    throw toDomainError(error);
  }
  if (count === 0) throw new VersionNotEditableError("Versi tidak lagi berstatus DRAF");
}

/**
 * Hapus hanya bila status masih DRAF dan berkasnya masih fileKey pada saat query
 * (atomik). Pemanggil menghapus berkas di disk SETELAH baris terhapus.
 */
export async function deleteDraftVersion(
  regulationId: string,
  versionId: string,
  fileKey: string | null,
): Promise<void> {
  const { count } = await getPrisma().version.deleteMany({
    where: { id: versionId, regulationId, status: "DRAF", fileKey },
  });
  if (count === 0) throw new VersionNotEditableError("Versi tidak lagi berstatus DRAF");
}
