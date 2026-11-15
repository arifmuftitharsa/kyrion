import { generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { bangunPayloadPengesahan } from "../crypto/payload-pengesahan";
import { idKunci } from "../crypto/tanda-tangan";
import {
  PenandatanganBelumSiapError,
  VersionEffectiveDateTakenError,
  VersionNotEditableError,
  VersionWithoutFileError,
} from "../domain/versi-admin";
import { isiTransaksiBatalkan, isiTransaksiSahkan } from "./pengesahan";

const VID = "0198a3a0-0000-7000-8000-000000000001";
const RID = "0198a3a0-0000-7000-8000-000000000002";
const UID = "0198a3a0-0000-7000-8000-000000000003";
const berkas = {
  versionNumber: "2026/1",
  effectiveDate: new Date("2026-01-01"),
  fileKey: "k",
  fileName: "a.pdf",
  fileSize: 10,
  fileSha256: "a".repeat(64),
};
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const penandatangan = { kunciPrivat: privateKey, idKunci: idKunci(publicKey.export({ type: "spki", format: "der" })) };
const p = {
  regulationId: RID,
  versionId: VID,
  actorId: UID,
  keterangan: "Aturan, versi 1",
  penanda: new Date("2026-02-02T00:00:00.000Z"),
  waktu: new Date("2026-03-03T00:00:00.000Z"),
  penandatangan,
};

function buatTx(
  o: { baca?: unknown; kembar?: unknown; kunci?: unknown; count?: number; audit?: ReturnType<typeof vi.fn> } = {},
) {
  const findFirst = vi.fn();
  findFirst.mockResolvedValueOnce("baca" in o ? o.baca : berkas).mockResolvedValueOnce(o.kembar ?? null);
  const kunciFindFirst = vi.fn().mockResolvedValue("kunci" in o ? o.kunci : { id: penandatangan.idKunci });
  const updateMany = vi.fn().mockResolvedValue({ count: o.count ?? 1 });
  const create = o.audit ?? vi.fn().mockResolvedValue({});
  const tx = {
    version: { findFirst, updateMany },
    signingKey: { findFirst: kunciFindFirst },
    auditLog: { create },
  } as unknown as Prisma.TransactionClient;
  return { tx, findFirst, updateMany, create, kunciFindFirst };
}

describe("isiTransaksiSahkan", () => {
  it("menulis status, pengesah, waktu, tanda tangan dengan penanda updatedAt, lalu audit di tx yang sama", async () => {
    const { tx, updateMany, create } = buatTx();
    await isiTransaksiSahkan(tx, p);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: VID, regulationId: RID, status: "DRAF", updatedAt: p.penanda },
      data: {
        status: "SAH",
        approvedById: UID,
        approvedAt: p.waktu,
        signature: expect.any(Uint8Array),
        signingKeyId: penandatangan.idKunci,
      },
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      data: { actorId: UID, action: "PENGESAHAN", objectType: "version", objectId: VID, keterangan: p.keterangan },
    });
  });

  describe("tanda tangan", () => {
    const masukanPayload = {
      id: VID,
      regulationId: RID,
      versionNumber: berkas.versionNumber,
      effectiveDate: "2026-01-01",
      fileSha256: berkas.fileSha256,
      fileName: berkas.fileName,
      fileSize: berkas.fileSize,
      approvedById: UID,
      approvedAt: p.waktu,
      signingKeyId: penandatangan.idKunci,
    };
    async function tersimpan(): Promise<Uint8Array> {
      const { tx, updateMany } = buatTx();
      await isiTransaksiSahkan(tx, p);
      return updateMany.mock.calls[0][0].data.signature as Uint8Array;
    }

    it("64 byte dan terverifikasi dengan node:crypto atas payload pengesahan", async () => {
      const ttd = await tersimpan();
      expect(ttd.byteLength).toBe(64);
      expect(verify(null, bangunPayloadPengesahan(masukanPayload), publicKey, ttd)).toBe(true);
    });

    it.each([
      ["approvedById", { approvedById: "0198a3a0-0000-7000-8000-0000000000ff" }],
      ["approvedAt", { approvedAt: new Date(p.waktu.getTime() + 1) }],
      ["signingKeyId", { signingKeyId: "b".repeat(32) }],
      ["versionNumber", { versionNumber: "2026/2" }],
      ["effectiveDate", { effectiveDate: "2026-01-02" }],
      ["fileSha256", { fileSha256: "c".repeat(64) }],
      ["fileName", { fileName: "b.pdf" }],
      ["fileSize", { fileSize: 11 }],
    ])("ubah %s membuat verifikasi gagal", async (_nama, ubah) => {
      const ttd = await tersimpan();
      expect(verify(null, bangunPayloadPengesahan({ ...masukanPayload, ...ubah }), publicKey, ttd)).toBe(false);
    });
  });

  it("kunci DB tidak ada atau bukan AKTIF ditolak tanpa updateMany dan audit", async () => {
    const { tx, updateMany, create, kunciFindFirst } = buatTx({ kunci: null });
    await expect(isiTransaksiSahkan(tx, p)).rejects.toBeInstanceOf(PenandatanganBelumSiapError);
    expect(kunciFindFirst).toHaveBeenCalledWith({
      where: { id: penandatangan.idKunci, status: "AKTIF" },
      select: { id: true },
    });
    expect(updateMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("kegagalan menandatangani (kunci privat rusak) tanpa updateMany dan audit", async () => {
    const { tx, updateMany, create } = buatTx();
    const rusak = { ...p, penandatangan: { ...penandatangan, kunciPrivat: publicKey } };
    await expect(isiTransaksiSahkan(tx, rusak)).rejects.toThrow();
    expect(updateMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("versi tidak ada sebagai DRAF melempar NotEditable tanpa tanda tangan dan audit", async () => {
    const { tx, updateMany, create, kunciFindFirst } = buatTx({ baca: null });
    await expect(isiTransaksiSahkan(tx, p)).rejects.toBeInstanceOf(VersionNotEditableError);
    expect(kunciFindFirst).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("tanpa berkas lengkap ditolak sebelum penandatanganan", async () => {
    const { tx, updateMany, create, kunciFindFirst } = buatTx({ baca: { ...berkas, fileSha256: null } });
    await expect(isiTransaksiSahkan(tx, p)).rejects.toBeInstanceOf(VersionWithoutFileError);
    expect(kunciFindFirst).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("tanggal kembar ditolak sebelum penandatanganan", async () => {
    const { tx, updateMany, create, findFirst, kunciFindFirst } = buatTx({ kembar: { id: "v9" } });
    await expect(isiTransaksiSahkan(tx, p)).rejects.toBeInstanceOf(VersionEffectiveDateTakenError);
    expect(findFirst.mock.calls[1][0].where).toMatchObject({
      regulationId: RID,
      id: { not: VID },
      status: { in: ["SAH", "DIGANTIKAN"] },
      effectiveDate: berkas.effectiveDate,
    });
    expect(kunciFindFirst).not.toHaveBeenCalled();
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
      where: { id: VID, regulationId: RID, status: "DRAF" },
      data: { status: "DIBATALKAN" },
    });
    expect(create).toHaveBeenCalledWith({
      data: { actorId: UID, action: "PEMBATALAN", objectType: "version", objectId: VID, keterangan: p.keterangan },
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
