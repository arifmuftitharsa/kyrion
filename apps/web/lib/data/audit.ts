import type { AuditAction, Prisma } from "@/generated/prisma/client";

// Tanpa "server-only": berkas ini hanya mengimpor tipe dan selalu menerima tx dari pemanggil.
// Log audit hanya ditambah: sengaja tidak ada fungsi ubah atau hapus.

/** Jenis objek yang dikenal; nilai awal hanya versi. */
export type ObjectTypeAudit = "version";

export interface EntriAudit {
  actorId: string;
  action: AuditAction;
  objectType: ObjectTypeAudit;
  objectId: string;
  /** Teks pendek non-rahasia, mis. nama regulasi dan nomor versi. */
  keterangan?: string;
}

/** Menerima tx dari pemanggil agar log ditulis dalam transaksi yang sama dengan perubahannya. */
export async function catatAudit(tx: Prisma.TransactionClient, entri: EntriAudit): Promise<void> {
  // Field ditulis satu per satu (tanpa spread): properti lain di objek pemanggil tidak sampai ke Prisma.
  await tx.auditLog.create({
    data: {
      actorId: entri.actorId,
      action: entri.action,
      objectType: entri.objectType,
      objectId: entri.objectId,
      keterangan: entri.keterangan ?? null,
    },
  });
}
