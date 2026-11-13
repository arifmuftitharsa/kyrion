import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import {
  VersionEffectiveDateTakenError,
  VersionNotEditableError,
  VersionWithoutFileError,
} from "../domain/versi-admin";
import { isiTransaksiBatalkan, isiTransaksiSahkan } from "./pengesahan";

const berkas = {
  effectiveDate: new Date("2026-01-01"),
  fileKey: "k",
  fileName: "a.pdf",
  fileSize: 10,
  fileSha256: "h",
};
const p = {
  regulationId: "r1",
  versionId: "v1",
  actorId: "u1",
  keterangan: "Aturan, versi 1",
  penanda: new Date("2026-02-02T00:00:00.000Z"),
  waktu: new Date("2026-03-03T00:00:00.000Z"),
};

function buatTx(o: { baca?: unknown; kembar?: unknown; count?: number; audit?: ReturnType<typeof vi.fn> } = {}) {
  const findFirst = vi.fn();
  findFirst.mockResolvedValueOnce("baca" in o ? o.baca : berkas).mockResolvedValueOnce(o.kembar ?? null);
  const updateMany = vi.fn().mockResolvedValue({ count: o.count ?? 1 });
  const create = o.audit ?? vi.fn().mockResolvedValue({});
  const tx = { version: { findFirst, updateMany }, auditLog: { create } } as unknown as Prisma.TransactionClient;
  return { tx, findFirst, updateMany, create };
}

describe("isiTransaksiSahkan", () => {
  it("menulis status, pengesah, waktu dengan penanda updatedAt, lalu audit di tx yang sama", async () => {
    const { tx, updateMany, create } = buatTx();
    await isiTransaksiSahkan(tx, p);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "v1", regulationId: "r1", status: "DRAF", updatedAt: p.penanda },
      data: { status: "SAH", approvedById: "u1", approvedAt: p.waktu },
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      data: { actorId: "u1", action: "PENGESAHAN", objectType: "version", objectId: "v1", keterangan: p.keterangan },
    });
  });

  it("versi tidak ada sebagai DRAF melempar NotEditable tanpa audit", async () => {
    const { tx, updateMany, create } = buatTx({ baca: null });
    await expect(isiTransaksiSahkan(tx, p)).rejects.toBeInstanceOf(VersionNotEditableError);
    expect(updateMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("tanpa berkas lengkap ditolak", async () => {
    const { tx, updateMany, create } = buatTx({ baca: { ...berkas, fileSha256: null } });
    await expect(isiTransaksiSahkan(tx, p)).rejects.toBeInstanceOf(VersionWithoutFileError);
    expect(updateMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("tanggal kembar ditolak", async () => {
    const { tx, updateMany, create, findFirst } = buatTx({ kembar: { id: "v9" } });
    await expect(isiTransaksiSahkan(tx, p)).rejects.toBeInstanceOf(VersionEffectiveDateTakenError);
    expect(findFirst.mock.calls[1][0].where).toMatchObject({
      regulationId: "r1",
      id: { not: "v1" },
      status: { in: ["SAH", "DIGANTIKAN"] },
      effectiveDate: berkas.effectiveDate,
    });
    expect(updateMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("count 0 melempar NotEditable dan audit tidak dipanggil", async () => {
    const { tx, create } = buatTx({ count: 0 });
    await expect(isiTransaksiSahkan(tx, p)).rejects.toBeInstanceOf(VersionNotEditableError);
    expect(create).not.toHaveBeenCalled();
  });

  it("galat catatAudit merambat", async () => {
    const { tx } = buatTx({ audit: vi.fn().mockRejectedValue(new Error("gagal")) });
    await expect(isiTransaksiSahkan(tx, p)).rejects.toThrow("gagal");
  });
});

describe("isiTransaksiBatalkan", () => {
  it("mengisi DIBATALKAN tanpa approved* dan mencatat audit", async () => {
    const { tx, updateMany, create } = buatTx();
    await isiTransaksiBatalkan(tx, p);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "v1", regulationId: "r1", status: "DRAF" },
      data: { status: "DIBATALKAN" },
    });
    expect(create).toHaveBeenCalledWith({
      data: { actorId: "u1", action: "PEMBATALAN", objectType: "version", objectId: "v1", keterangan: p.keterangan },
    });
  });

  it("count 0 melempar NotEditable tanpa audit", async () => {
    const { tx, create } = buatTx({ count: 0 });
    await expect(isiTransaksiBatalkan(tx, p)).rejects.toBeInstanceOf(VersionNotEditableError);
    expect(create).not.toHaveBeenCalled();
  });

  it("galat catatAudit merambat", async () => {
    const { tx } = buatTx({ audit: vi.fn().mockRejectedValue(new Error("gagal")) });
    await expect(isiTransaksiBatalkan(tx, p)).rejects.toThrow("gagal");
  });
});
