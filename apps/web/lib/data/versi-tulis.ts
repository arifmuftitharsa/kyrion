import type { Prisma } from "@/generated/prisma/client";
import { VersionNotEditableError } from "../domain/versi-admin";
import { catatAudit } from "./audit";

// Tanpa "server-only": berkas ini hanya mengimpor tipe Prisma dan selalu menerima tx dari
// pemanggil. Impor relatif karena Vitest berjalan tanpa alias "@/".

export interface PelakuAudit {
  actorId: string;
  keterangan: string;
}

/** id wajib ada: dipakai sebagai objectId log (di tipe Prisma ia opsional). */
export type DataBuatVersi = Prisma.VersionUncheckedCreateInput & { id: string };

function catat(tx: Prisma.TransactionClient, action: "UNGGAH_BERKAS" | "PENGHAPUSAN", versionId: string, a: PelakuAudit) {
  return catatAudit(tx, {
    actorId: a.actorId,
    action,
    objectType: "version",
    objectId: versionId,
    keterangan: a.keterangan,
  });
}

/** Buat versi; log UNGGAH_BERKAS hanya bila dibuat dengan berkas. */
export async function isiTransaksiBuat(
  tx: Prisma.TransactionClient,
  data: DataBuatVersi,
  audit: PelakuAudit,
  adaBerkas: boolean,
): Promise<void> {
  await tx.version.create({ data });
  if (adaBerkas) await catat(tx, "UNGGAH_BERKAS", data.id, audit);
}

/** Log UNGGAH_BERKAS untuk berkas baru pada versi yang sudah ada (dipanggil setelah updateMany count > 0). */
export function catatUnggahBerkas(tx: Prisma.TransactionClient, versionId: string, audit: PelakuAudit) {
  return catat(tx, "UNGGAH_BERKAS", versionId, audit);
}

export interface ParamHapus {
  regulationId: string;
  versionId: string;
  fileKey: string | null;
  audit: PelakuAudit;
}

/** Hapus Draf; count 0 melempar tanpa log. */
export async function isiTransaksiHapus(tx: Prisma.TransactionClient, p: ParamHapus): Promise<void> {
  const { count } = await tx.version.deleteMany({
    where: { id: p.versionId, regulationId: p.regulationId, status: "DRAF", fileKey: p.fileKey },
  });
  if (count === 0) throw new VersionNotEditableError("Versi tidak lagi berstatus DRAF");
  await catat(tx, "PENGHAPUSAN", p.versionId, p.audit);
}
