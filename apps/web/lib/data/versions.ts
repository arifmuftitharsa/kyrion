import "server-only";
import { randomUUID } from "node:crypto";
import { connection } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { dataTerlindungDariBaris, type BarisVersi } from "@/lib/crypto/data-terlindung";
import { RegulationNotFoundError } from "@/lib/domain/regulasi";
import { todayInJakarta } from "@/lib/domain/tanggal";
import { terapkanStatusTurunan } from "@/lib/domain/versi";
import { tandatanganiVersi } from "@/lib/integritas-versi";
import { VersionNotEditableError, VersionNumberTakenError } from "@/lib/domain/versi-admin";
import {
  isiTransaksiBatalkan,
  isiTransaksiSahkan,
  type ParamBatalkan,
  type ParamSahkan,
} from "@/lib/data/pengesahan";
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

/**
 * Kolom yang dibutuhkan unduhan dan verifikasi tag (F-31): ketujuh field terlindung,
 * kunci disk, dan tag. Dipakai bersama oleh unduhan admin dan unduhan publik.
 */
export const berkasSelect = {
  id: true,
  regulationId: true,
  versionNumber: true,
  effectiveDate: true,
  fileKey: true,
  fileName: true,
  fileSize: true,
  fileSha256: true,
  integrityTag: true,
} satisfies Prisma.VersionSelect;

type BerkasRow = Prisma.VersionGetPayload<{ select: typeof berkasSelect }>;

/** undefined bila baris tidak ada atau versinya tidak punya berkas lengkap. */
export function toBerkasTersimpan(row: BerkasRow | null): BerkasTersimpan | undefined {
  if (!row?.fileKey || !row.fileName || !row.fileSha256 || row.fileSize === null) return undefined;
  return {
    id: row.id,
    regulationId: row.regulationId,
    versionNumber: row.versionNumber,
    // Kolom date dibaca sebagai 00.00 UTC, jadi bagian tanggal UTC selalu tepat.
    effectiveDate: row.effectiveDate.toISOString().slice(0, 10),
    key: row.fileKey,
    name: row.fileName,
    size: row.fileSize,
    sha256: row.fileSha256,
    tag: row.integrityTag,
  };
}

/** Tag F-31 untuk nilai yang AKAN ditulis; null bila versi tidak punya berkas lengkap. */
async function hitungTag(baris: BarisVersi): Promise<string | null> {
  const data = dataTerlindungDariBaris(baris);
  return data ? tandatanganiVersi(data) : null;
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
  // Label dihitung setelah effectiveDate menjadi string ISO (bukan Date).
  return terapkanStatusTurunan(rows.map(toAdminVersion), todayInJakarta(new Date()));
}

/**
 * Status untuk TAMPILAN (label turunan) satu versi. Hanya untuk halaman, bukan guard
 * atau Server Action: itu memakai findVersion (status tersimpan). Memuat semua versi
 * saudara karena label bergantung pada versi lain.
 */
export async function getStatusTampilan(
  regulationId: string,
  versionId: string,
): Promise<VersionStatus | undefined> {
  const semua = await getAdminVersions(regulationId);
  return semua.find((v) => v.id === versionId)?.status;
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
    select: berkasSelect,
    where: { id: versionId, regulationId },
  });
  return toBerkasTersimpan(row);
}

/**
 * Versi baru selalu berstatus DRAF (PRD 5.1); berkas opsional ditulis dalam insert yang sama.
 * ID dibuat di sini (bukan default uuidv7 di DB) karena ID ikut ditandatangani dan harus
 * diketahui sebelum INSERT. Tag dihitung dari nilai yang ditulis; tanpa berkas, tag null.
 */
export async function createVersion(
  regulationId: string,
  masukan: MasukanVersi,
  berkas?: DataBerkas,
): Promise<void> {
  const id = randomUUID();
  const data = toVersionData(masukan);
  const integrityTag = await hitungTag({
    id,
    regulationId,
    versionNumber: data.versionNumber,
    effectiveDate: data.effectiveDate,
    fileSha256: berkas?.sha256 ?? null,
    fileName: berkas?.name ?? null,
    fileSize: berkas?.size ?? null,
  });
  try {
    await getPrisma().version.create({
      data: {
        ...data,
        ...(berkas && toFileData(berkas)),
        id,
        integrityTag,
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
  const data = toVersionData(masukan);
  let count: number;
  try {
    // Tag memuat versionNumber dan effectiveDate, yang berubah pada setiap ubah, jadi tag
    // dihitung ulang dari berkas yang berlaku sesudah update. Tanpa berkas baru itu berkas
    // yang sekarang di DB; dibaca dalam transaksi yang sama dengan penulisannya.
    count = await getPrisma().$transaction(async (tx) => {
      const saat = await tx.version.findFirst({
        where: { id: versionId, regulationId, status: "DRAF" },
        select: { fileKey: true, fileName: true, fileSize: true, fileSha256: true },
      });
      if (!saat) return 0;

      const integrityTag = await hitungTag({
        id: versionId,
        regulationId,
        versionNumber: data.versionNumber,
        effectiveDate: data.effectiveDate,
        fileSha256: berkas ? berkas.baru.sha256 : saat.fileSha256,
        fileName: berkas ? berkas.baru.name : saat.fileName,
        fileSize: berkas ? berkas.baru.size : saat.fileSize,
      });
      const hasil = await tx.version.updateMany({
        where: {
          id: versionId,
          regulationId,
          status: "DRAF",
          // Berkas harus masih yang tadi dibaca (atau keyLama bila diganti), kalau tidak
          // tag yang dihitung tidak sesuai isi baris dan tidak boleh ditulis.
          fileKey: berkas ? berkas.keyLama : saat.fileKey,
        },
        data: { ...data, ...(berkas && toFileData(berkas.baru)), integrityTag },
      });
      return hasil.count;
    });
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

/** Pengesahan atomik bersama log audit (F-13, F-15); galat bertipe dari isiTransaksiSahkan. */
export async function sahkanVersiDraf(p: ParamSahkan): Promise<void> {
  await getPrisma().$transaction((tx) => isiTransaksiSahkan(tx, p));
}

/** Pembatalan atomik bersama log audit; berkas tidak dihapus. */
export async function batalkanVersiDraf(p: ParamBatalkan): Promise<void> {
  await getPrisma().$transaction((tx) => isiTransaksiBatalkan(tx, p));
}

/** Penanda versi untuk halaman konfirmasi sahkan: updatedAt sebagai string ISO. */
export async function getPenandaVersi(regulationId: string, versionId: string): Promise<string | undefined> {
  const row = await getPrisma().version.findFirst({
    select: { updatedAt: true },
    where: { id: versionId, regulationId },
  });
  return row?.updatedAt.toISOString();
}
