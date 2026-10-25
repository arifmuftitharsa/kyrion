import { describe, expect, it } from "vitest";
import { kategoriBolehDihapus, pesanTolakHapusKategori } from "./kategori";
import { createSlug } from "./slug";

describe("kategoriBolehDihapus", () => {
  it.each([
    [0, true],
    [1, false],
    [5, false],
  ])("jumlah regulasi %i menghasilkan %s", (jumlah, expected) => {
    expect(kategoriBolehDihapus(jumlah)).toBe(expected);
  });
});

describe("pesanTolakHapusKategori", () => {
  it("menyebut jumlah regulasi dan aturan hapus", () => {
    expect(pesanTolakHapusKategori(2)).toBe(
      "Kategori ini dipakai 2 regulasi dan tidak dapat dihapus. Hanya kategori tanpa regulasi yang dapat dihapus.",
    );
  });
});

// Nama mirip ditolak karena slug-nya sama (slug unik di basis data).
describe("nama kategori mirip menghasilkan slug sama", () => {
  it.each(["Akademik", "  akademik ", "AKADEMIK"])("%j menjadi akademik", (nama) => {
    expect(createSlug(nama)).toBe("akademik");
  });

  it("spasi ganda dianggap sama", () => {
    expect(createSlug("Akademik  Umum")).toBe(createSlug("akademik umum"));
    expect(createSlug("akademik umum")).toBe("akademik-umum");
  });

  it.each(["!!!", "   "])("%j menghasilkan slug kosong (ditolak di action)", (nama) => {
    expect(createSlug(nama)).toBe("");
  });
});
