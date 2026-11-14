import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jagaRoute } from "@/lib/akses/jaga-route";
import { buatMasalah } from "@/lib/api/masalah";
import { getRegulationBySlug } from "@/lib/data/regulations";
import type { Regulation, Version } from "@/lib/types";
import { GET } from "./route";

// Lapisan data ditiru: modul asli (Prisma, next/server, server-only) tidak pernah dimuat.
vi.mock("@/lib/akses/jaga-route", () => ({ jagaRoute: vi.fn() }));
vi.mock("@/lib/data/regulations", () => ({ getRegulationBySlug: vi.fn() }));

const jagaMock = vi.mocked(jagaRoute);
const dataMock = vi.mocked(getRegulationBySlug);

const versi = (id: string, effectiveDate: string, status: Version["status"] = "SAH"): Version => ({
  id,
  versionNumber: `v-${id}`,
  effectiveDate,
  status,
  changeSummary: null,
  fileSize: 100,
});

const regulasi = (slug: string, versions: Version[]): Regulation => ({
  slug,
  name: `Regulasi ${slug}`,
  category: "Perpajakan",
  description: null,
  versions,
});

const ringkas = (id: string, effectiveDate: string, status: Version["status"]) => ({
  id,
  versionNumber: `v-${id}`,
  effectiveDate,
  status,
});

// Urutan mengikuti lib/data: effectiveDate menurun.
const DUA_VERSI = [versi("baru", "2026-01-01"), versi("lama", "2020-01-01", "DIGANTIKAN")];

const panggil = (slug: string, query = "") =>
  GET(new Request(`http://localhost/api/v1/regulations/${slug}/current-version${query}`), {
    params: Promise.resolve({ slug }),
  });

beforeEach(() => {
  jagaMock.mockResolvedValue({ sesi: { userId: "u1", email: "a@kampus.ac.id", role: "SIVITAS" } });
  // Hanya Date yang dibekukan: 2026-11-12 pukul 12.00 WIB.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-12T05:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  dataMock.mockReset();
});

describe("GET /api/v1/regulations/{slug}/current-version: sukses", () => {
  it("200 tanpa date: memakai hari ini WIB, header benar", async () => {
    dataMock.mockResolvedValue(regulasi("pph", DUA_VERSI));

    const res = await panggil("pph");

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(dataMock).toHaveBeenCalledWith("pph");
    expect(await res.json()).toEqual({
      data: { slug: "pph", date: "2026-11-12", currentVersion: ringkas("baru", "2026-01-01", "SAH") },
    });
  });

  it("200 date di antara dua versi: versi lama berstatus Digantikan", async () => {
    dataMock.mockResolvedValue(regulasi("pph", DUA_VERSI));

    const { data } = await (await panggil("pph", "?date=2024-12-01")).json();

    expect(data.date).toBe("2024-12-01");
    expect(data.currentVersion).toEqual(ringkas("lama", "2020-01-01", "DIGANTIKAN"));
  });

  it("200 date tepat di tanggal mulai berlaku: versi itu terpilih", async () => {
    dataMock.mockResolvedValue(regulasi("pph", DUA_VERSI));

    const { data } = await (await panggil("pph", "?date=2026-01-01")).json();

    expect(data.currentVersion).toEqual(ringkas("baru", "2026-01-01", "SAH"));
  });

  it("200 date sebelum versi pertama: currentVersion null", async () => {
    dataMock.mockResolvedValue(regulasi("pph", DUA_VERSI));

    const res = await panggil("pph", "?date=2019-12-31");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: { slug: "pph", date: "2019-12-31", currentVersion: null },
    });
  });

  it("Draf dan Dibatalkan tidak pernah terpilih", async () => {
    dataMock.mockResolvedValue(
      regulasi("pph", [
        versi("draf", "2026-06-01", "DRAF"),
        versi("batal", "2026-03-01", "DIBATALKAN"),
        versi("sah", "2026-01-01"),
      ]),
    );
    const { data } = await (await panggil("pph", "?date=2026-11-12")).json();
    expect(data.currentVersion).toEqual(ringkas("sah", "2026-01-01", "SAH"));

    dataMock.mockResolvedValue(
      regulasi("lain", [versi("draf", "2026-06-01", "DRAF"), versi("batal", "2026-03-01", "DIBATALKAN")]),
    );
    const kosong = await (await panggil("lain", "?date=2026-11-12")).json();
    expect(kosong.data.currentVersion).toBeNull();
  });
});

describe("GET /api/v1/regulations/{slug}/current-version: 400 validation-error", () => {
  it.each([
    ["format salah (garis miring)", "?date=2026/01/01", "date"],
    ["bukan tanggal", "?date=abc", "date"],
    ["date kosong", "?date=", "date"],
    ["tanggal mustahil (30 Februari)", "?date=2026-02-30", "date"],
    ["bulan mustahil (13)", "?date=2026-13-01", "date"],
    ["parameter tak dikenal", "?x=1", "x"],
    ["parameter ganda", "?date=2026-01-01&date=2026-02-01", "date"],
  ])("%s", async (_nama, query, field) => {
    const res = await panggil("pph", query);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
    expect(body.type).toBe("/problems/validation-error");
    expect(body.errors).toEqual([expect.objectContaining({ field, message: expect.any(String) })]);
    expect(dataMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/regulations/{slug}/current-version: 404 not-found", () => {
  it("slug tidak ada di data", async () => {
    dataMock.mockResolvedValue(undefined);

    const res = await panggil("tidak-ada");

    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
    expect((await res.json()).type).toBe("/problems/not-found");
  });

  it.each(["SALAH!", "A", "a--b", "-a"])("slug berformat salah %s: data tidak dipanggil", async (slug) => {
    const res = await panggil(slug);

    expect(res.status).toBe(404);
    expect((await res.json()).type).toBe("/problems/not-found");
    expect(dataMock).not.toHaveBeenCalled();
  });

  it("slug berformat salah diutamakan atas query salah: tetap 404", async () => {
    const res = await panggil("SALAH!", "?date=bukan-tanggal&x=1");

    expect(res.status).toBe(404);
    expect((await res.json()).type).toBe("/problems/not-found");
    expect(dataMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/regulations/{slug}/current-version: 500 internal-error", () => {
  it("galat data: body generik, log hanya nama galat", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    dataMock.mockRejectedValue(new Error("rahasia-koneksi-db"));

    const res = await panggil("pph");
    const teks = await res.text();

    expect(res.status).toBe(500);
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
    expect(JSON.parse(teks).type).toBe("/problems/internal-error");
    expect(teks).not.toContain("rahasia-koneksi-db");
    expect(log).toHaveBeenCalledWith("Galat versi berlaku:", "Error");
    expect(JSON.stringify(log.mock.calls)).not.toContain("rahasia-koneksi-db");
  });
});

describe("tanpa sesi", () => {
  it("401 application/problem+json, lapisan data tidak dipanggil", async () => {
    jagaMock.mockImplementation(async (_syarat, request) => ({
      respons: buatMasalah("unauthenticated", request, { detail: "Perlu masuk." }),
    }));

    const res = await panggil("pph");

    expect(jagaMock).toHaveBeenCalledWith("masuk", expect.any(Request), "problem");
    expect(res.status).toBe(401);
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
    expect(dataMock).not.toHaveBeenCalled();
  });
});
