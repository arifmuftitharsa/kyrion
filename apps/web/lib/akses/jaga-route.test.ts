import { notFound, redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bacaSesi } from "@/lib/sesi";
import { jagaRoute } from "./jaga-route";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("@/lib/sesi", () => ({ bacaSesi: vi.fn() }));

const sesiMock = vi.mocked(bacaSesi);
const request = new Request("http://localhost/admin/x/berkas");
const admin = { userId: "u1", sesiId: "s1", email: "a@kampus.ac.id", role: "ADMIN" as const };
const sivitas = { ...admin, role: "SIVITAS" as const };

beforeEach(() => vi.clearAllMocks());

// Adapter Route Handler tidak boleh pernah memanggil redirect() atau notFound().
afterEach(() => {
  expect(redirect).not.toHaveBeenCalled();
  expect(notFound).not.toHaveBeenCalled();
});

describe.each(["problem", "teks"] as const)("jagaRoute bentuk %s", (bentuk) => {
  it("anonim -> 401", async () => {
    sesiMock.mockResolvedValue(null);
    const hasil = await jagaRoute("admin", request, bentuk);
    expect("respons" in hasil && hasil.respons.status).toBe(401);
  });

  it("SIVITAS dengan syarat admin -> 403", async () => {
    sesiMock.mockResolvedValue(sivitas);
    const hasil = await jagaRoute("admin", request, bentuk);
    expect("respons" in hasil && hasil.respons.status).toBe(403);
  });

  it("ADMIN -> lolos dengan sesi", async () => {
    sesiMock.mockResolvedValue(admin);
    expect(await jagaRoute("admin", request, bentuk)).toEqual({ sesi: admin });
  });
});

describe.each(["problem", "teks"] as const)("jagaRoute syarat masuk, bentuk %s", (bentuk) => {
  it("SIVITAS -> lolos", async () => {
    sesiMock.mockResolvedValue(sivitas);
    expect(await jagaRoute("masuk", request, bentuk)).toEqual({ sesi: sivitas });
  });

  it("ADMIN -> lolos", async () => {
    sesiMock.mockResolvedValue(admin);
    expect(await jagaRoute("masuk", request, bentuk)).toEqual({ sesi: admin });
  });

  it("anonim -> 401", async () => {
    sesiMock.mockResolvedValue(null);
    const hasil = await jagaRoute("masuk", request, bentuk);
    if (!("respons" in hasil)) throw new Error("harus ditolak");
    expect(hasil.respons.status).toBe(401);
    if (bentuk === "teks") expect(await hasil.respons.text()).toBe("Perlu masuk.");
  });
});

describe("jagaRoute isi respons", () => {
  it("problem: application/problem+json", async () => {
    sesiMock.mockResolvedValue(null);
    const hasil = await jagaRoute("admin", request, "problem");
    if (!("respons" in hasil)) throw new Error("harus ditolak");
    expect(hasil.respons.headers.get("Content-Type")).toBe("application/problem+json");
    expect((await hasil.respons.json()).status).toBe(401);
  });

  it("teks: teks biasa tanpa detail", async () => {
    sesiMock.mockResolvedValue(sivitas);
    const hasil = await jagaRoute("admin", request, "teks");
    if (!("respons" in hasil)) throw new Error("harus ditolak");
    expect(hasil.respons.headers.get("Content-Type")).toContain("text/plain");
    expect(await hasil.respons.text()).toBe("Tidak diizinkan.");
  });
});
