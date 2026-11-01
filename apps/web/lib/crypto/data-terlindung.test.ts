import { describe, expect, it } from "vitest";
import { dataTerlindungDariBaris, type BarisVersi } from "./data-terlindung";

// DATA SINTETIS: id, nomor versi, dan nama berkas fiktif.
const BARIS: BarisVersi = {
  id: "0196b6a0-3c1e-7b2a-9f4d-5e8a1c2b3d4f",
  regulationId: "0196b6a0-1111-7000-8000-000000000001",
  versionNumber: "2025/2026",
  effectiveDate: new Date("2026-01-05T00:00:00.000Z"),
  fileSha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  fileName: "pedoman-akademik.pdf",
  fileSize: 123456,
};

describe("dataTerlindungDariBaris", () => {
  it("memetakan baris lengkap menjadi data terlindung", () => {
    expect(dataTerlindungDariBaris(BARIS)).toEqual({
      id: BARIS.id,
      regulationId: BARIS.regulationId,
      versionNumber: "2025/2026",
      effectiveDate: "2026-01-05",
      fileSha256: BARIS.fileSha256,
      fileName: "pedoman-akademik.pdf",
      fileSize: 123456,
    });
  });

  it.each<[string, Partial<BarisVersi>]>([
    ["fileSha256", { fileSha256: null }],
    ["fileName", { fileName: null }],
    ["fileSize", { fileSize: null }],
  ])("mengembalikan null bila %s kosong", (_nama, ubah) => {
    expect(dataTerlindungDariBaris({ ...BARIS, ...ubah })).toBeNull();
  });

  it("mengembalikan null bila ketiga field berkas kosong (versi tanpa berkas)", () => {
    const tanpaBerkas = { ...BARIS, fileSha256: null, fileName: null, fileSize: null };
    expect(dataTerlindungDariBaris(tanpaBerkas)).toBeNull();
  });

  it("menganggap fileSize 0 sebagai nilai sah, bukan kosong", () => {
    expect(dataTerlindungDariBaris({ ...BARIS, fileSize: 0 })?.fileSize).toBe(0);
  });

  it("menghasilkan hasil sama untuk Date dan string tanggal", () => {
    const dariDate = dataTerlindungDariBaris(BARIS);
    const dariString = dataTerlindungDariBaris({ ...BARIS, effectiveDate: "2026-01-05" });
    expect(dariString).toEqual(dariDate);
  });

  // Tanggal dibaca dan ditulis sebagai 00.00 UTC; formatnya harus UTC agar tidak
  // bergeser sehari di zona waktu mana pun.
  it.each([
    ["akhir bulan", "2026-01-31"],
    ["akhir Februari tahun kabisat", "2028-02-29"],
    ["akhir tahun", "2026-12-31"],
    ["awal tahun", "2026-01-01"],
  ])("tidak menggeser tanggal %s", (_nama, iso) => {
    const dariDate = dataTerlindungDariBaris({ ...BARIS, effectiveDate: new Date(`${iso}T00:00:00.000Z`) });
    const dariString = dataTerlindungDariBaris({ ...BARIS, effectiveDate: iso });
    expect(dariDate?.effectiveDate).toBe(iso);
    expect(dariString?.effectiveDate).toBe(iso);
  });

  it("memakai basis UTC: 23.59 UTC tetap pada tanggal yang sama", () => {
    const hasil = dataTerlindungDariBaris({
      ...BARIS,
      effectiveDate: new Date("2025-12-31T23:59:59.999Z"),
    });
    expect(hasil?.effectiveDate).toBe("2025-12-31");
  });
});
