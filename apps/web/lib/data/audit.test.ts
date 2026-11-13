import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { catatAudit, type EntriAudit } from "./audit";

function buatTx(create = vi.fn().mockResolvedValue({})) {
  return { tx: { auditLog: { create } } as unknown as Prisma.TransactionClient, create };
}

const entri: EntriAudit = {
  actorId: "0192a000-0000-7000-8000-000000000001",
  action: "PENGESAHAN",
  objectType: "version",
  objectId: "0192a000-0000-7000-8000-000000000002",
  keterangan: "Peraturan Akademik, versi 2",
};

describe("catatAudit", () => {
  it("mengirim data sesuai entri ke auditLog.create tepat sekali", async () => {
    const { tx, create } = buatTx();
    await catatAudit(tx, entri);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({ data: entri });
  });

  it("keterangan boleh kosong dan disimpan sebagai null", async () => {
    const { tx, create } = buatTx();
    await catatAudit(tx, { ...entri, keterangan: undefined });
    expect(create).toHaveBeenCalledWith({ data: { ...entri, keterangan: null } });
  });

  it("tidak meneruskan properti lain dari objek pemanggil", async () => {
    const { tx, create } = buatTx();
    await catatAudit(tx, { ...entri, rahasia: "x", id: "y" } as EntriAudit);
    expect(Object.keys(create.mock.calls[0][0].data).sort()).toEqual(
      ["action", "actorId", "keterangan", "objectId", "objectType"],
    );
  });

  it("galat dari create merambat ke pemanggil", async () => {
    const { tx } = buatTx(vi.fn().mockRejectedValue(new Error("gagal")));
    await expect(catatAudit(tx, entri)).rejects.toThrow("gagal");
  });

  it("objectType di luar nilai yang dikenal ditolak kompilator", () => {
    // @ts-expect-error "regulation" bukan ObjectTypeAudit
    const salah: EntriAudit = { ...entri, objectType: "regulation" };
    expect(salah).toBeDefined();
  });
});
