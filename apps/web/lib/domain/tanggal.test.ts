import { describe, expect, it } from "vitest";
import { NAMA_BULAN, pecahTanggalIso, susunTanggalIso, todayInJakarta } from "./tanggal";

describe("todayInJakarta", () => {
  it("masih tanggal yang sama pada 23.59.59 WIB", () => {
    expect(todayInJakarta(new Date("2026-10-24T16:59:59Z"))).toBe("2026-10-24");
  });

  it("berganti tanggal tepat pada 00.00 WIB (17.00 UTC)", () => {
    expect(todayInJakarta(new Date("2026-10-24T17:00:00Z"))).toBe("2026-10-25");
  });
});

describe("susunTanggalIso", () => {
  it.each([
    [1, 7, 2027, "2027-07-01"],
    [9, 12, 2026, "2026-12-09"],
  ])("%i/%i/%i menjadi %s", (hari, bulan, tahun, expected) => {
    expect(susunTanggalIso(hari, bulan, tahun)).toBe(expected);
  });
});

describe("pecahTanggalIso", () => {
  it("memecah tanggal ISO tanpa nol di depan", () => {
    expect(pecahTanggalIso("2027-07-01")).toEqual({ hari: 1, bulan: 7, tahun: 2027 });
  });
});

describe("NAMA_BULAN", () => {
  it("berisi 12 bulan dari Januari sampai Desember", () => {
    expect(NAMA_BULAN).toHaveLength(12);
    expect(NAMA_BULAN[0]).toBe("Januari");
    expect(NAMA_BULAN[11]).toBe("Desember");
  });
});
