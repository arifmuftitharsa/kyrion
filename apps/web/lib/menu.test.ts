import { describe, expect, it } from "vitest";
import { pilihMenu } from "./menu";

const labels = (peran: Parameters<typeof pilihMenu>[0]) => pilihMenu(peran).tautan.map((t) => t.label);

describe("pilihMenu", () => {
  it("tamu: umum + Masuk, tanpa Keluar", () => {
    expect(labels(null)).toEqual(["Daftar Regulasi", "Verifikasi Dokumen", "Masuk"]);
    expect(pilihMenu(null).bisaKeluar).toBe(false);
  });

  it("Sivitas: umum, dengan Keluar", () => {
    expect(labels("SIVITAS")).toEqual(["Daftar Regulasi", "Verifikasi Dokumen"]);
    expect(pilihMenu("SIVITAS").bisaKeluar).toBe(true);
  });

  it("Admin: umum + Kelola Regulasi, dengan Keluar", () => {
    expect(labels("ADMIN")).toEqual(["Daftar Regulasi", "Verifikasi Dokumen", "Kelola Regulasi"]);
    expect(pilihMenu("ADMIN").bisaKeluar).toBe(true);
  });
});
