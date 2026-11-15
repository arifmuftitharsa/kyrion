import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERNAH_DISAHKAN } from "@/lib/domain/versi";
import { getPrisma } from "@/lib/prisma";
import type { Regulation } from "@/lib/types";
import { getRegulationBySlug, getRegulations, getRegulationsByCategory } from "./regulations";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("@/lib/prisma", () => ({ getPrisma: vi.fn() }));
// Client Prisma hasil generate tidak dimuat; hanya dipakai untuk instanceof di jalur galat tulis.
vi.mock("@/generated/prisma/client", () => ({ Prisma: { PrismaClientKnownRequestError: class {} } }));

const findMany = vi.fn();
const findUnique = vi.fn();

// Baris sengaja membawa kolom yang tidak boleh keluar, untuk membuktikan toRegulation membuangnya.
const KOLOM_TERLARANG = [
  "changeSummary",
  "fileKey",
  "fileName",
  "fileSha256",
  "integrityTag",
  "signature",
  "signingKeyId",
  "approvedById",
] as const;

const barisVersi = {
  id: "0198a3a0-0000-7000-8000-0000000000b1",
  versionNumber: "1.0",
  effectiveDate: new Date("2026-01-01T00:00:00.000Z"),
  status: "SAH",
  fileSize: 1234,
  changeSummary: "ringkasan-rahasia",
  fileKey: "kunci-disk-rahasia",
  fileName: "nama-asli.pdf",
  fileSha256: "a".repeat(64),
  integrityTag: "v1$" + "b".repeat(64),
  signature: new Uint8Array([1, 2, 3]),
  signingKeyId: "id-kunci-rahasia",
  approvedById: "0198a3a0-0000-7000-8000-000000000001",
};

const barisRegulasi = {
  slug: "pedoman-akademik",
  name: "Pedoman Akademik",
  description: null,
  category: { name: "Akademik" },
  versions: [barisVersi],
};

// Tiap fungsi publik: nama, pemanggil yang menyeragamkan hasil jadi larik, dan metode Prisma yang dipakai.
const FUNGSI_PUBLIK: [string, () => Promise<Regulation[]>, typeof findMany][] = [
  ["getRegulations", () => getRegulations(), findMany],
  ["getRegulationsByCategory", () => getRegulationsByCategory(), findMany],
  ["getRegulationBySlug", async () => [(await getRegulationBySlug("pedoman-akademik"))!], findUnique],
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPrisma).mockReturnValue({
    regulation: { findMany, findUnique },
  } as unknown as ReturnType<typeof getPrisma>);
  findMany.mockResolvedValue([barisRegulasi]);
  findUnique.mockResolvedValue(barisRegulasi);
});

describe.each(FUNGSI_PUBLIK)("%s", (_nama, panggil, metodePrisma) => {
  it("query hanya versi pernah disahkan (tanpa DRAF dan DIBATALKAN) dan omit changeSummary", async () => {
    await panggil();
    const { include } = metodePrisma.mock.calls[0][0];
    expect(include.versions.where).toEqual({ status: { in: [...PERNAH_DISAHKAN] } });
    expect(include.versions.where.status.in).not.toContain("DRAF");
    expect(include.versions.where.status.in).not.toContain("DIBATALKAN");
    expect(include.versions.omit).toEqual({ changeSummary: true });
  });

  it("hasil hanya memuat id, versionNumber, effectiveDate, status, fileSize pada versi", async () => {
    const [regulasi] = await panggil();
    expect(Object.keys(regulasi).sort()).toEqual(["category", "description", "name", "slug", "versions"]);
    expect(regulasi.versions).toHaveLength(1);
    expect(Object.keys(regulasi.versions[0]).sort()).toEqual([
      "effectiveDate",
      "fileSize",
      "id",
      "status",
      "versionNumber",
    ]);
    expect(regulasi.versions[0].fileSize).toBe(1234);
    expect(regulasi.versions[0].effectiveDate).toBe("2026-01-01");
  });

  it.each(KOLOM_TERLARANG)("kolom %s tidak muncul pada hasil", async (kolom) => {
    const hasil = await panggil();
    expect(JSON.stringify(hasil)).not.toContain(`"${kolom}"`);
    expect(JSON.stringify(hasil)).not.toMatch(/ringkasan-rahasia|kunci-disk-rahasia|nama-asli\.pdf|id-kunci-rahasia/);
  });
});

describe("getRegulationBySlug", () => {
  it("slug dipakai sebagai where; baris tidak ada -> undefined", async () => {
    findUnique.mockResolvedValue(null);
    expect(await getRegulationBySlug("tidak-ada")).toBeUndefined();
    expect(findUnique.mock.calls[0][0].where).toEqual({ slug: "tidak-ada" });
  });
});

describe("getRegulationsByCategory", () => {
  it("slug kategori menyaring lewat where; tanpa slug where kosong", async () => {
    await getRegulationsByCategory("akademik");
    expect(findMany.mock.calls[0][0].where).toEqual({ category: { slug: "akademik" } });
    await getRegulationsByCategory();
    expect(findMany.mock.calls[1][0].where).toEqual({});
  });
});
