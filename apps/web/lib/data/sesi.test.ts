import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPrisma } from "@/lib/prisma";
import { cabutSesi, daftarSesiAktif } from "./sesi";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ getPrisma: vi.fn() }));

const findMany = vi.fn();
const deleteMany = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPrisma).mockReturnValue({
    session: { findMany, deleteMany },
  } as unknown as ReturnType<typeof getPrisma>);
});

describe("cabutSesi", () => {
  it("where memuat id DAN userId", async () => {
    deleteMany.mockResolvedValue({ count: 1 });
    expect(await cabutSesi("sesi-b", "user-a")).toBe(true);
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: "sesi-b", userId: "user-a" } });
  });

  it("A mencabut sesi B: tidak ada baris cocok -> false", async () => {
    deleteMany.mockResolvedValue({ count: 0 });
    expect(await cabutSesi("sesi-b", "user-a")).toBe(false);
  });
});

describe("daftarSesiAktif", () => {
  it("hanya milik userId, belum kedaluwarsa, terbaru dulu, tanpa token/ip/UA", async () => {
    findMany.mockResolvedValue([]);
    const sekarang = new Date("2026-11-14T00:00:00Z");
    await daftarSesiAktif("user-a", sekarang);
    const arg = findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ userId: "user-a", expiresAt: { gt: sekarang } });
    expect(arg.select).toEqual({ id: true, createdAt: true, expiresAt: true });
    expect(arg.orderBy[0]).toEqual({ createdAt: "desc" });
  });
});
