import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jagaRoute } from "@/lib/akses/jaga-route";
import { buatMasalah } from "@/lib/api/masalah";
import { daftarSesiAktif } from "@/lib/data/sesi";
import { GET } from "./route";

// Lapisan data ditiru: modul asli (Prisma, server-only) tidak pernah dimuat.
vi.mock("@/lib/akses/jaga-route", () => ({ jagaRoute: vi.fn() }));
vi.mock("@/lib/data/sesi", () => ({ daftarSesiAktif: vi.fn() }));

const jagaMock = vi.mocked(jagaRoute);
const dataMock = vi.mocked(daftarSesiAktif);

const SAYA = "0198a3a0-0000-7000-8000-000000000001";
const LAIN = "0198a3a0-0000-7000-8000-000000000002";

// Baris sengaja membawa kolom yang tidak boleh keluar, untuk membuktikan petakan membuangnya.
const baris = (id: string, hari: number) => ({
  id,
  createdAt: new Date(`2026-11-0${hari}T00:00:00.000Z`),
  expiresAt: new Date(`2026-11-1${hari}T00:00:00.000Z`),
  token: "token-rahasia-xyz",
  ipAddress: "203.0.113.9",
  userAgent: "AgenRahasia/1.0",
});

const panggil = () => GET(new Request("http://localhost/api/v1/sessions"));
const sesi = (role: "ADMIN" | "SIVITAS") => ({ userId: "u1", sesiId: SAYA, email: "a@kampus.ac.id", role });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  jagaMock.mockResolvedValue({ sesi: sesi("SIVITAS") });
  dataMock.mockResolvedValue([baris(SAYA, 2), baris(LAIN, 1)] as never);
});
afterEach(() => vi.restoreAllMocks());

describe("GET /api/v1/sessions", () => {
  it("anonim -> 401", async () => {
    jagaMock.mockResolvedValue({
      respons: buatMasalah("unauthenticated", new Request("http://localhost/x"), { detail: "Perlu masuk." }),
    });
    expect((await panggil()).status).toBe(401);
    expect(dataMock).not.toHaveBeenCalled();
  });

  it("syarat jagaRoute: masuk, bentuk problem", async () => {
    await panggil();
    expect(jagaMock.mock.calls[0][0]).toBe("masuk");
    expect(jagaMock.mock.calls[0][2]).toBe("problem");
  });

  it.each(["SIVITAS", "ADMIN"] as const)("%s -> 200", async (role) => {
    jagaMock.mockResolvedValue({ sesi: sesi(role) });
    expect((await panggil()).status).toBe(200);
  });

  it("userId yang diteruskan ke data = userId sesi", async () => {
    await panggil();
    expect(dataMock.mock.calls[0][0]).toBe("u1");
    expect(dataMock.mock.calls[0][1]).toBeInstanceOf(Date);
  });

  it("tepat kunci id, createdAt, expiresAt, current; tanpa token, ipAddress, userAgent", async () => {
    const respons = await panggil();
    const teks = await respons.clone().text();
    const { data } = await respons.json();
    expect(data).toHaveLength(2);
    for (const item of data) {
      expect(Object.keys(item).sort()).toEqual(["createdAt", "current", "expiresAt", "id"]);
    }
    expect(teks).not.toMatch(/token-rahasia-xyz|203\.0\.113\.9|AgenRahasia/);
  });

  it("current benar hanya untuk sesiId saat ini", async () => {
    const { data } = await (await panggil()).json();
    expect(data.map((s: { id: string; current: boolean }) => [s.id, s.current])).toEqual([
      [SAYA, true],
      [LAIN, false],
    ]);
  });

  it("Cache-Control no-store", async () => {
    expect((await panggil()).headers.get("Cache-Control")).toBe("no-store");
  });

  it("galat tak terduga -> 500, log hanya nama galat", async () => {
    dataMock.mockRejectedValue(new TypeError("jejak-rahasia"));
    const respons = await panggil();
    expect(respons.status).toBe(500);
    expect(await respons.text()).not.toContain("jejak-rahasia");
    expect(console.error).toHaveBeenCalledWith("Galat daftar sesi:", "TypeError");
  });
});
