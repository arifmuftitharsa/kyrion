import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jagaRoute } from "@/lib/akses/jaga-route";
import { buatMasalah } from "@/lib/api/masalah";
import { cabutSesi } from "@/lib/data/sesi";
import { DELETE } from "./route";

// Lapisan data ditiru: modul asli (Prisma, server-only) tidak pernah dimuat.
vi.mock("@/lib/akses/jaga-route", () => ({ jagaRoute: vi.fn() }));
vi.mock("@/lib/data/sesi", () => ({ cabutSesi: vi.fn() }));

const jagaMock = vi.mocked(jagaRoute);
const dataMock = vi.mocked(cabutSesi);

const ORIGIN = "http://localhost:3000";
const SAYA = "0198a3a0-0000-7000-8000-000000000001";
const SESI_B = "0198a3a0-0000-7000-8000-000000000002";

const panggil = (id: string, origin: string | null = ORIGIN) =>
  DELETE(
    new Request(`http://localhost:3000/api/v1/sessions/${id}`, {
      method: "DELETE",
      headers: origin === null ? {} : { Origin: origin },
    }),
    { params: Promise.resolve({ id }) },
  );

beforeEach(() => {
  vi.clearAllMocks();
  // Nilai tiruan; env asli tidak dibaca.
  vi.stubEnv("BETTER_AUTH_SECRET", "x".repeat(32));
  vi.stubEnv("BETTER_AUTH_URL", ORIGIN);
  vi.spyOn(console, "error").mockImplementation(() => {});
  jagaMock.mockResolvedValue({ sesi: { userId: "user-a", sesiId: SAYA, email: "a@kampus.ac.id", role: "SIVITAS" } });
  dataMock.mockResolvedValue(true);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("DELETE /api/v1/sessions/{id}", () => {
  it.each([["https://evil.example"], [null], ["null"]])("Origin %s -> 403, data tidak dipanggil", async (origin) => {
    const respons = await panggil(SESI_B, origin);
    expect(respons.status).toBe(403);
    expect((await respons.json()).detail).toBe("Origin tidak diizinkan.");
    expect(jagaMock).not.toHaveBeenCalled();
    expect(dataMock).not.toHaveBeenCalled();
  });

  it("anonim (Origin benar) -> 401", async () => {
    jagaMock.mockResolvedValue({
      respons: buatMasalah("unauthenticated", new Request(ORIGIN), { detail: "Perlu masuk." }),
    });
    expect((await panggil(SESI_B)).status).toBe(401);
    expect(dataMock).not.toHaveBeenCalled();
  });

  it("syarat jagaRoute: masuk, bentuk problem", async () => {
    await panggil(SESI_B);
    expect(jagaMock.mock.calls[0][0]).toBe("masuk");
    expect(jagaMock.mock.calls[0][2]).toBe("problem");
  });

  it("id bukan UUID -> 404 tanpa memanggil data", async () => {
    const respons = await panggil("bukan-uuid");
    expect(respons.status).toBe(404);
    expect(respons.headers.get("Content-Type")).toBe("application/problem+json");
    expect(dataMock).not.toHaveBeenCalled();
  });

  it("A mencabut sesi B -> cabutSesi(idB, userIdA) false -> 404", async () => {
    dataMock.mockResolvedValue(false);
    const respons = await panggil(SESI_B);
    expect(dataMock).toHaveBeenCalledWith(SESI_B, "user-a");
    expect(respons.status).toBe(404);
    expect((await respons.json()).type).toBe("/problems/not-found");
  });

  it("sesi sendiri -> 204 tanpa body dan tanpa Content-Type", async () => {
    const respons = await panggil(SAYA);
    expect(dataMock).toHaveBeenCalledWith(SAYA, "user-a");
    expect(respons.status).toBe(204);
    expect(await respons.text()).toBe("");
    expect(respons.headers.get("Content-Type")).toBeNull();
    expect(respons.headers.get("Cache-Control")).toBe("no-store");
  });

  it("galat tak terduga -> 500, log hanya nama galat", async () => {
    dataMock.mockRejectedValue(new TypeError("jejak-rahasia"));
    const respons = await panggil(SESI_B);
    expect(respons.status).toBe(500);
    expect(await respons.text()).not.toContain("jejak-rahasia");
    expect(console.error).toHaveBeenCalledWith("Galat cabut sesi:", "TypeError");
  });
});
