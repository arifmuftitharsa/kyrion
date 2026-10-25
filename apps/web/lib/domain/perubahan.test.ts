import { describe, expect, it } from "vitest";
import { pesanTolakHapusPerubahan, pesanTolakUbahPerubahan } from "./perubahan";

describe("pesan penolakan perubahan", () => {
  it.each([
    ["SAH", "Sah"],
    ["DIGANTIKAN", "Digantikan"],
    ["DIBATALKAN", "Dibatalkan"],
  ] as const)("menyebut label status %s saat ubah ditolak", (status, label) => {
    expect(pesanTolakUbahPerubahan(status)).toBe(
      `Perubahan pada versi berstatus ${label} tidak dapat diubah. Hanya perubahan pada versi Draf yang dapat diubah.`,
    );
  });

  it.each([
    ["SAH", "Sah"],
    ["DIGANTIKAN", "Digantikan"],
    ["DIBATALKAN", "Dibatalkan"],
  ] as const)("menyebut label status %s saat hapus ditolak", (status, label) => {
    expect(pesanTolakHapusPerubahan(status)).toBe(
      `Perubahan pada versi berstatus ${label} tidak dapat dihapus. Hanya perubahan pada versi Draf yang dapat dihapus.`,
    );
  });
});
