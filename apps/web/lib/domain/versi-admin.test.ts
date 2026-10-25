import { describe, expect, it } from "vitest";
import type { VersionStatus } from "../types";
import {
  pesanTolakHapusVersi,
  pesanTolakUbahVersi,
  versiBolehDihapus,
  versiBolehDiubah,
} from "./versi-admin";

// Keempat status diuji agar status baru yang lupa ditangani ketahuan.
const kasus: [VersionStatus, boolean][] = [
  ["DRAF", true],
  ["SAH", false],
  ["DIGANTIKAN", false],
  ["DIBATALKAN", false],
];

describe("versiBolehDiubah", () => {
  it.each(kasus)("status %s menghasilkan %s", (status, expected) => {
    expect(versiBolehDiubah(status)).toBe(expected);
  });
});

describe("versiBolehDihapus", () => {
  it.each(kasus)("status %s menghasilkan %s", (status, expected) => {
    expect(versiBolehDihapus(status)).toBe(expected);
  });
});

describe("pesan penolakan", () => {
  it("menyebut label status saat ubah ditolak", () => {
    expect(pesanTolakUbahVersi("SAH")).toBe(
      "Versi berstatus Sah tidak dapat diubah. Hanya versi Draf yang dapat diubah.",
    );
  });

  it("menyebut label status saat hapus ditolak", () => {
    expect(pesanTolakHapusVersi("DIBATALKAN")).toBe(
      "Versi berstatus Dibatalkan tidak dapat dihapus. Hanya versi Draf yang dapat dihapus.",
    );
  });
});
