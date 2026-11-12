import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRegulationsByCategory } from "@/lib/data/regulations";
import type { Regulation, Version } from "@/lib/types";
import { GET } from "./route";

// Lapisan data ditiru: modul asli (Prisma, next/server, server-only) tidak pernah dimuat.
vi.mock("@/lib/data/regulations", () => ({ getRegulationsByCategory: vi.fn() }));

const dataMock = vi.mocked(getRegulationsByCategory);

const versi = (id: string, effectiveDate: string, status: Version["status"] = "SAH"): Version => ({
  id,
  versionNumber: `v-${id}`,
  effectiveDate,
  status,
  changeSummary: "ringkasan",
  fileSize: 100,
});

const regulasi = (slug: string, versions: Version[]): Regulation => ({
  slug,
  name: `Regulasi ${slug}`,
  category: "Perpajakan",
  description: null,
  versions,
});

const panggil = (query = "") => GET(new Request(`http://localhost/api/v1/regulations${query}`));

beforeEach(() => {
  // Hanya Date yang dibekukan: 2026-11-12 pukul 12.00 WIB.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-12T05:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  dataMock.mockReset();
});

describe("GET /api/v1/regulations: sukses", () => {
  it("200 tanpa filter: header, bentuk data, tanpa daftar versi", async () => {
    dataMock.mockResolvedValue([
      regulasi("pph", [versi("a", "2020-01-01", "DIGANTIKAN"), versi("b", "2026-01-01")]),
    ]);

    const res = await panggil();

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(dataMock).toHaveBeenCalledWith(undefined);
    expect(await res.json()).toEqual({
      data: [
        {
          slug: "pph",
          name: "Regulasi pph",
          category: "Perpajakan",
          description: null,
          currentVersion: { id: "b", versionNumber: "v-b", effectiveDate: "2026-01-01", status: "SAH" },
        },
      ],
    });
  });

  it("200 dengan category: slug diteruskan ke lapisan data", async () => {
    dataMock.mockResolvedValue([regulasi("pph", [versi("a", "2020-01-01")])]);

    const res = await panggil("?category=perpajakan");

    expect(res.status).toBe(200);
    expect(dataMock).toHaveBeenCalledWith("perpajakan");
  });

  it("currentVersion null bila belum ada versi berlaku", async () => {
    dataMock.mockResolvedValue([
      regulasi("kosong", []),
      regulasi("mendatang", [versi("x", "2027-01-01")]),
    ]);

    const { data } = await (await panggil()).json();

    expect(data.map((r: { currentVersion: unknown }) => r.currentVersion)).toEqual([null, null]);
  });

  it("category berformat sah tetapi tak dikenal: 200 dengan data kosong", async () => {
    dataMock.mockResolvedValue([]);

    const res = await panggil("?category=tidak-ada");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: [] });
  });
});

describe("GET /api/v1/regulations: 400 validation-error", () => {
  it.each([
    ["format slug salah", "?category=SALAH!", "category"],
    ["parameter tak dikenal", "?x=1", "x"],
    ["parameter ganda", "?category=a&category=b", "category"],
    ["kunci __proto__", "?__proto__=1", "__proto__"],
  ])("%s", async (_nama, query, field) => {
    const res = await panggil(query);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
    expect(body.type).toBe("/problems/validation-error");
    expect(body.errors).toEqual([expect.objectContaining({ field, message: expect.any(String) })]);
    expect(dataMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/regulations: 500 internal-error", () => {
  it("galat data: body generik, log hanya nama galat", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    dataMock.mockRejectedValue(new Error("rahasia-koneksi-db"));

    const res = await panggil();
    const teks = await res.text();

    expect(res.status).toBe(500);
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
    expect(JSON.parse(teks).type).toBe("/problems/internal-error");
    expect(teks).not.toContain("rahasia-koneksi-db");
    expect(log).toHaveBeenCalledWith("Galat daftar regulasi:", "Error");
    expect(JSON.stringify(log.mock.calls)).not.toContain("rahasia-koneksi-db");
  });
});
