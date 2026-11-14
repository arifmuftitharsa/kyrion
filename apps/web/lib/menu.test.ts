import { describe, expect, it } from "vitest";
import { pilihMenu } from "./menu";

const labels = (peran: Parameters<typeof pilihMenu>[0]) => pilihMenu(peran).tautan.map((t) => t.label);

describe("pilihMenu", () => {
  it("tamu: hanya Masuk, tanpa Keluar", () => {
    expect(labels(null)).toEqual(["Masuk"]);
    expect(pilihMenu(null).bisaKeluar).toBe(false);
  });

  it("Sivitas: Daftar Regulasi dan Sesi, dengan Keluar", () => {
    expect(labels("SIVITAS")).toEqual(["Daftar Regulasi", "Sesi"]);
    expect(pilihMenu("SIVITAS").bisaKeluar).toBe(true);
  });

  it("Admin: Daftar Regulasi, Kelola Regulasi, Periksa Berkas, Sesi; dengan Keluar", () => {
    expect(labels("ADMIN")).toEqual(["Daftar Regulasi", "Kelola Regulasi", "Periksa Berkas", "Sesi"]);
    expect(pilihMenu("ADMIN").tautan.at(-1)?.href).toBe("/akun/sesi");
    expect(pilihMenu("ADMIN").bisaKeluar).toBe(true);
  });
});
