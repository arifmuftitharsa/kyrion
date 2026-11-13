import { describe, expect, it } from "vitest";
import type { VersionStatus } from "../types";
import {
  alasanTolakSahkan,
  pesanTolakBatalkanVersi,
  pesanTolakSahkan,
  versiBolehDibatalkan,
  versiBolehDisahkan,
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

describe("versiBolehDibatalkan", () => {
  it.each(kasus)("status %s menghasilkan %s", (status, expected) => {
    expect(versiBolehDibatalkan(status)).toBe(expected);
  });
});

describe("versiBolehDisahkan", () => {
  const ok = { status: "DRAF" as VersionStatus, berkasLengkap: true, tanggalKembar: false };

  it("Draf berberkas tanpa tanggal kembar boleh", () => {
    expect(versiBolehDisahkan(ok)).toBe(true);
    expect(alasanTolakSahkan(ok)).toBeUndefined();
  });

  it("tanpa berkas ditolak", () => {
    expect(alasanTolakSahkan({ ...ok, berkasLengkap: false })).toBe("TANPA_BERKAS");
  });

  it("tanggal kembar ditolak", () => {
    expect(alasanTolakSahkan({ ...ok, tanggalKembar: true })).toBe("TANGGAL_KEMBAR");
  });

  it.each(["SAH", "DIGANTIKAN", "DIBATALKAN"] as VersionStatus[])("status %s ditolak lebih dulu", (status) => {
    expect(alasanTolakSahkan({ status, berkasLengkap: false, tanggalKembar: true })).toBe("BUKAN_DRAF");
    expect(versiBolehDisahkan({ ...ok, status })).toBe(false);
  });

  it("pesan tiap alasan", () => {
    expect(pesanTolakSahkan("BUKAN_DRAF", "SAH")).toBe(
      "Versi berstatus Sah tidak dapat disahkan. Hanya versi Draf yang dapat disahkan.",
    );
    expect(pesanTolakSahkan("TANPA_BERKAS", "DRAF")).toContain("berkas PDF");
    expect(pesanTolakSahkan("TANGGAL_KEMBAR", "DRAF")).toContain("tanggal berlaku yang sama");
    expect(pesanTolakBatalkanVersi("SAH")).toBe(
      "Versi berstatus Sah tidak dapat dibatalkan. Hanya versi Draf yang dapat dibatalkan.",
    );
  });
});
