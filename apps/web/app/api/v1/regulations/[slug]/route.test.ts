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
  fileSize: 100,
});

const regulasi = (slug: string, versions: Version[]): Regulation => ({
  slug,
  name: `Regulasi ${slug}`,
  category: "Perpajakan",
  description: null,
  versions,
});

const panggil = (slug: string, query = "") =>
  GET(new Request(`http://localhost/api/v1/regulations/${slug}${query}`), {
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

describe("GET /api/v1/regulations/{slug}: sukses", () => {
  it("200: header, versi terurut terbaru, currentVersion benar", async () => {
    dataMock.mockResolvedValue(
      regulasi("pph", [
        versi("lama", "2020-01-01", "DIGANTIKAN"),
        versi("baru", "2026-01-01"),
        versi("tengah", "2023-01-01", "DIGANTIKAN"),
      ]),
    );

    const res = await panggil("pph");

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(dataMock).toHaveBeenCalledWith("pph");
    expect(await res.json()).toEqual({
      data: {
        slug: "pph",
        name: "Regulasi pph",
        category: "Perpajakan",
        description: null,
        currentVersion: { id: "baru", versionNumber: "v-baru", effectiveDate: "2026-01-01", status: "SAH" },
        versions: ["baru", "tengah", "lama"].map((id) => ({
          id,
          versionNumber: `v-${id}`,
          effectiveDate: { baru: "2026-01-01", tengah: "2023-01-01", lama: "2020-01-01" }[id],
          status: id === "baru" ? "SAH" : "DIGANTIKAN",
          fileSize: 100,
        })),
      },
    });
  });

  it("200: item versions tidak memuat changeSummary dan tetap memuat fileSize", async () => {
    dataMock.mockResolvedValue(regulasi("pph", [versi("a", "2026-01-01"), versi("b", "2020-01-01", "DIGANTIKAN")]));

    const { data } = await (await panggil("pph")).json();

    expect(data.versions).toHaveLength(2);
    for (const item of data.versions) {
      expect(item).not.toHaveProperty("changeSummary");
      expect(item).toHaveProperty("fileSize", 100);
    }
  });

  it("200 dengan currentVersion null bila belum ada versi berlaku", async () => {
    dataMock.mockResolvedValue(regulasi("mendatang", [versi("x", "2027-01-01")]));

    const { data } = await (await panggil("mendatang")).json();

    expect(data.currentVersion).toBeNull();
    expect(data.versions).toHaveLength(1);
  });
});

describe("GET /api/v1/regulations/{slug}: 404 not-found", () => {
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
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
    expect((await res.json()).type).toBe("/problems/not-found");
    expect(dataMock).not.toHaveBeenCalled();
  });

  it("slug berformat salah diutamakan atas parameter query: tetap 404", async () => {
    const res = await panggil("SALAH!", "?x=1");

    expect(res.status).toBe(404);
    expect((await res.json()).type).toBe("/problems/not-found");
    expect(dataMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/regulations/{slug}: 400 validation-error", () => {
  it.each([
    ["parameter tak dikenal", "?x=1", "x"],
    ["parameter category", "?category=a", "category"],
    ["parameter ganda", "?x=1&x=2", "x"],
    ["kunci __proto__", "?__proto__=1", "__proto__"],
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

describe("GET /api/v1/regulations/{slug}: 500 internal-error", () => {
  it("galat data: body generik, log hanya nama galat", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    dataMock.mockRejectedValue(new Error("rahasia-koneksi-db"));

    const res = await panggil("pph");
    const teks = await res.text();

    expect(res.status).toBe(500);
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
    expect(JSON.parse(teks).type).toBe("/problems/internal-error");
    expect(teks).not.toContain("rahasia-koneksi-db");
    expect(log).toHaveBeenCalledWith("Galat detail regulasi:", "Error");
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
