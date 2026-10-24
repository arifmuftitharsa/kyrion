import { describe, expect, it } from "vitest";
import { pesanTolakHapus, regulasiBolehDihapus } from "./regulasi";

describe("regulasiBolehDihapus", () => {
  it.each([
    [0, true],
    [1, false],
    [5, false],
  ])("jumlah versi %i menghasilkan %s", (jumlahVersi, expected) => {
    expect(regulasiBolehDihapus(jumlahVersi)).toBe(expected);
  });
});

describe("pesanTolakHapus", () => {
  it("menyebut jumlah versi dan aturan hapus", () => {
    expect(pesanTolakHapus(3)).toBe(
      "Regulasi ini memiliki 3 versi dan tidak dapat dihapus. Hanya regulasi tanpa versi yang dapat dihapus.",
    );
  });
});
