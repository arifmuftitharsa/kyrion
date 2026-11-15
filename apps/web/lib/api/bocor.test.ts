import { describe, expect, it } from "vitest";
import { petakanRegulasi } from "@/lib/api/daftar-regulasi";
import { petakanDetailRegulasi } from "@/lib/api/detail-regulasi";
import { petakanVersiBerlakuPadaTanggal } from "@/lib/api/versi-berlaku";
import type { Regulation } from "@/lib/types";

// Kolom tabel versions yang tidak boleh sampai ke respons API (schema.prisma, model Version).
const KUNCI_TERLARANG = [
  "changeSummary",
  "fileKey",
  "fileName",
  "fileSha256",
  "fileUploadedAt",
  "integrityTag",
  "signature",
  "signingKeyId",
  "approvedById",
  "approvedAt",
] as const;

const HARI_INI = "2026-06-01";

// Masukan sengaja membawa semua kolom terlarang (pola baris() di sessions/route.test.ts),
// supaya terbukti pemeta membuangnya, bukan sekadar tidak pernah menerimanya.
const bawaanTerlarang = {
  changeSummary: "ringkasan-rahasia",
  fileKey: "kunci-disk-rahasia",
  fileName: "nama-asli.pdf",
  fileSha256: "a".repeat(64),
  fileUploadedAt: "2026-01-01T00:00:00.000Z",
  integrityTag: "v1$" + "b".repeat(64),
  signature: "tanda-tangan-rahasia",
  signingKeyId: "id-kunci-rahasia",
  approvedById: "0198a3a0-0000-7000-8000-000000000001",
  approvedAt: "2026-01-01T00:00:00.000Z",
};

const regulasi = {
  slug: "pedoman-akademik",
  name: "Pedoman Akademik",
  category: "Akademik",
  description: "Deskripsi",
  ...bawaanTerlarang,
  versions: [
    {
      id: "0198a3a0-0000-7000-8000-0000000000b1",
      versionNumber: "1.0",
      effectiveDate: "2026-01-01",
      status: "SAH",
      fileSize: 1234,
      ...bawaanTerlarang,
    },
  ],
} as unknown as Regulation;

/** Semua nama kunci pada objek hasil, di kedalaman mana pun (objek dan larik). */
function semuaKunci(nilai: unknown): string[] {
  if (Array.isArray(nilai)) return nilai.flatMap(semuaKunci);
  if (nilai === null || typeof nilai !== "object") return [];
  return Object.entries(nilai).flatMap(([kunci, isi]) => [kunci, ...semuaKunci(isi)]);
}

// Kolom ketiga = kunci yang wajib ada menurut docs/api/openapi.yaml (RingkasanRegulasi,
// DetailRegulasi, VersiBerlakuPadaTanggal), supaya uji tidak lolos karena hasil kosong.
const PEMETA: [string, () => unknown, string[]][] = [
  ["petakanRegulasi", () => petakanRegulasi([regulasi], HARI_INI), ["slug", "name", "category", "description", "currentVersion"]],
  ["petakanDetailRegulasi", () => petakanDetailRegulasi(regulasi, HARI_INI), ["slug", "name", "category", "description", "currentVersion", "versions"]],
  ["petakanVersiBerlakuPadaTanggal", () => petakanVersiBerlakuPadaTanggal(regulasi, HARI_INI), ["slug", "date", "currentVersion"]],
];

describe.each(PEMETA)("%s", (_nama, petakan, kunciSah) => {
  it.each(KUNCI_TERLARANG)("tanpa kunci %s pada kedalaman mana pun", (kunci) => {
    expect(semuaKunci(petakan())).not.toContain(kunci);
  });

  it("kunci sah tetap ada (hasil tidak kosong)", () => {
    expect(semuaKunci(petakan())).toEqual(expect.arrayContaining(kunciSah));
  });
});

describe("kunci sah pada versi", () => {
  it("detail: tiap versi tepat id, versionNumber, effectiveDate, status, fileSize; fileSize tetap ada", () => {
    const { versions } = petakanDetailRegulasi(regulasi, HARI_INI);
    expect(versions).toHaveLength(1);
    expect(Object.keys(versions[0]).sort()).toEqual([
      "effectiveDate",
      "fileSize",
      "id",
      "status",
      "versionNumber",
    ]);
    expect(versions[0].fileSize).toBe(1234);
  });

  it("currentVersion tepat id, versionNumber, effectiveDate, status", () => {
    const { currentVersion } = petakanVersiBerlakuPadaTanggal(regulasi, HARI_INI);
    expect(currentVersion).not.toBeNull();
    expect(Object.keys(currentVersion ?? {}).sort()).toEqual([
      "effectiveDate",
      "id",
      "status",
      "versionNumber",
    ]);
  });
});
