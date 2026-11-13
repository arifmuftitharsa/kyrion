import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { VersionNotEditableError } from "../domain/versi-admin";
import { catatUnggahBerkas, isiTransaksiBuat, isiTransaksiHapus } from "./versi-tulis";

const audit = { actorId: "u1", keterangan: "Aturan, versi 1" };
const data = { id: "v1", regulationId: "r1", versionNumber: "1", effectiveDate: new Date("2026-01-01") };

function buatTx(o: { count?: number; auditGagal?: Error } = {}) {
  const create = vi.fn().mockResolvedValue({});
  const deleteMany = vi.fn().mockResolvedValue({ count: o.count ?? 1 });
  const auditCreate = o.auditGagal ? vi.fn().mockRejectedValue(o.auditGagal) : vi.fn().mockResolvedValue({});
  const tx = {
    version: { create, deleteMany },
    auditLog: { create: auditCreate },
  } as unknown as Prisma.TransactionClient;
  return { tx, create, deleteMany, auditCreate };
}

const entri = (action: string) => ({
  data: { actorId: "u1", action, objectType: "version", objectId: "v1", keterangan: audit.keterangan },
});

describe("isiTransaksiBuat", () => {
  it("dengan berkas: create dan audit UNGGAH_BERKAS di tx yang sama", async () => {
    const { tx, create, auditCreate } = buatTx();
    await isiTransaksiBuat(tx, data, audit, true);
    expect(create).toHaveBeenCalledWith({ data });
    expect(auditCreate).toHaveBeenCalledWith(entri("UNGGAH_BERKAS"));
  });

  it("tanpa berkas: tidak ada audit", async () => {
    const { tx, create, auditCreate } = buatTx();
    await isiTransaksiBuat(tx, data, audit, false);
    expect(create).toHaveBeenCalledTimes(1);
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("galat audit merambat", async () => {
    const { tx } = buatTx({ auditGagal: new Error("audit gagal") });
    await expect(isiTransaksiBuat(tx, data, audit, true)).rejects.toThrow("audit gagal");
  });
});

describe("catatUnggahBerkas", () => {
  it("menulis UNGGAH_BERKAS; galat merambat", async () => {
    const ok = buatTx();
    await catatUnggahBerkas(ok.tx, "v1", audit);
    expect(ok.auditCreate).toHaveBeenCalledWith(entri("UNGGAH_BERKAS"));
    const gagal = buatTx({ auditGagal: new Error("audit gagal") });
    await expect(catatUnggahBerkas(gagal.tx, "v1", audit)).rejects.toThrow("audit gagal");
  });
});

describe("isiTransaksiHapus", () => {
  const p = { regulationId: "r1", versionId: "v1", fileKey: "k", audit };

  it("count 1: deleteMany bersyarat lalu audit PENGHAPUSAN", async () => {
    const { tx, deleteMany, auditCreate } = buatTx();
    await isiTransaksiHapus(tx, p);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: "v1", regulationId: "r1", status: "DRAF", fileKey: "k" },
    });
    expect(auditCreate).toHaveBeenCalledWith(entri("PENGHAPUSAN"));
  });

  it("count 0: NotEditable tanpa audit", async () => {
    const { tx, auditCreate } = buatTx({ count: 0 });
    await expect(isiTransaksiHapus(tx, p)).rejects.toBeInstanceOf(VersionNotEditableError);
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("galat audit merambat", async () => {
    const { tx } = buatTx({ auditGagal: new Error("audit gagal") });
    await expect(isiTransaksiHapus(tx, p)).rejects.toThrow("audit gagal");
  });
});
