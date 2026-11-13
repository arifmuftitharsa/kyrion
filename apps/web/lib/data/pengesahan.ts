import type { Prisma } from "@/generated/prisma/client";
import { PERNAH_DISAHKAN } from "../domain/versi";
import {
  VersionEffectiveDateTakenError,
  VersionNotEditableError,
  VersionWithoutFileError,
} from "../domain/versi-admin";
import { catatAudit } from "./audit";

// Tanpa "server-only": berkas ini hanya mengimpor tipe Prisma dan selalu menerima tx dari
// pemanggil. Impor relatif karena Vitest berjalan tanpa alias "@/".

export interface ParamBatalkan {
  regulationId: string;
  versionId: string;
  actorId: string;
  keterangan: string;
}

export interface ParamSahkan extends ParamBatalkan {
  /** versions.updatedAt yang dilihat admin di halaman konfirmasi. */
  penanda: Date;
  waktu: Date;
}

const GALAT_BUKAN_DRAF = "Versi tidak lagi berstatus DRAF atau sudah berubah";

/** Isi transaksi sahkan: tidak pernah menulis DIGANTIKAN dan tidak menyentuh integrityTag. */
export async function isiTransaksiSahkan(tx: Prisma.TransactionClient, p: ParamSahkan): Promise<void> {
  const saat = await tx.version.findFirst({
    where: { id: p.versionId, regulationId: p.regulationId, status: "DRAF" },
    select: { effectiveDate: true, fileKey: true, fileName: true, fileSize: true, fileSha256: true },
  });
  if (!saat) throw new VersionNotEditableError(GALAT_BUKAN_DRAF);

  if (!saat.fileKey || !saat.fileName || !saat.fileSha256 || saat.fileSize === null) {
    throw new VersionWithoutFileError("Versi tidak punya berkas lengkap");
  }

  const kembar = await tx.version.findFirst({
    where: {
      regulationId: p.regulationId,
      id: { not: p.versionId },
      status: { in: [...PERNAH_DISAHKAN] },
      effectiveDate: saat.effectiveDate,
    },
    select: { id: true },
  });
  if (kembar) throw new VersionEffectiveDateTakenError("Tanggal berlaku sudah dipakai versi sah lain");

  const { count } = await tx.version.updateMany({
    where: { id: p.versionId, regulationId: p.regulationId, status: "DRAF", updatedAt: p.penanda },
    data: { status: "SAH", approvedById: p.actorId, approvedAt: p.waktu },
  });
  if (count === 0) throw new VersionNotEditableError(GALAT_BUKAN_DRAF);

  await catatAudit(tx, {
    actorId: p.actorId,
    action: "PENGESAHAN",
    objectType: "version",
    objectId: p.versionId,
    keterangan: p.keterangan,
  });
}

/** Isi transaksi batalkan: berkas tidak dihapus, approved* tidak diisi. */
export async function isiTransaksiBatalkan(tx: Prisma.TransactionClient, p: ParamBatalkan): Promise<void> {
  const { count } = await tx.version.updateMany({
    where: { id: p.versionId, regulationId: p.regulationId, status: "DRAF" },
    data: { status: "DIBATALKAN" },
  });
  if (count === 0) throw new VersionNotEditableError(GALAT_BUKAN_DRAF);

  await catatAudit(tx, {
    actorId: p.actorId,
    action: "PEMBATALAN",
    objectType: "version",
    objectId: p.versionId,
    keterangan: p.keterangan,
  });
}
