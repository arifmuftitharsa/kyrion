import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isiTransaksiSahkan } from "@/lib/data/pengesahan";
import { getPrisma } from "@/lib/prisma";
import { sahkanVersiDenganAudit } from "./versions";

// Hanya modul yang dibutuhkan jalur sahkan yang dipakai; sisanya ditiru agar impor tidak berefek.
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/generated/prisma/client", () => ({ Prisma: { PrismaClientKnownRequestError: class {} } }));
vi.mock("@/lib/integritas-versi", () => ({ tandatanganiVersi: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/lib/data/pengesahan", () => ({ isiTransaksiSahkan: vi.fn(), isiTransaksiBatalkan: vi.fn() }));
vi.mock("@/lib/data/versi-tulis", () => ({
  catatUnggahBerkas: vi.fn(),
  isiTransaksiBuat: vi.fn(),
  isiTransaksiHapus: vi.fn(),
}));

const tx = { penanda: "tx" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-14T03:00:00Z"));
  vi.mocked(getPrisma).mockReturnValue({
    $transaction: vi.fn((fn: (t: unknown) => Promise<void>) => fn(tx)),
  } as unknown as ReturnType<typeof getPrisma>);
});
afterEach(() => vi.useRealTimers());

describe("sahkanVersiDenganAudit", () => {
  it("membentuk keterangan dan waktu, lalu memanggil isiTransaksiSahkan di transaksi", async () => {
    const penanda = new Date("2026-11-01T00:00:00Z");
    await sahkanVersiDenganAudit({
      regulasi: { id: "r1", name: "Aturan Contoh" },
      versi: { id: "v1", versionNumber: "2.0" },
      penanda,
      admin: { id: "u1" },
    });
    expect(isiTransaksiSahkan).toHaveBeenCalledWith(tx, {
      regulationId: "r1",
      versionId: "v1",
      penanda,
      actorId: "u1",
      keterangan: "Aturan Contoh, versi 2.0",
      waktu: new Date("2026-11-14T03:00:00Z"),
    });
  });

  it("galat dari transaksi diteruskan apa adanya", async () => {
    const galat = new Error("gagal");
    vi.mocked(isiTransaksiSahkan).mockRejectedValue(galat);
    await expect(
      sahkanVersiDenganAudit({
        regulasi: { id: "r1", name: "A" },
        versi: { id: "v1", versionNumber: "1" },
        penanda: new Date(),
        admin: { id: "u1" },
      }),
    ).rejects.toBe(galat);
  });
});
