import { describe, expect, it } from "vitest";
import type { Version, VersionStatus } from "../types";
import { findEffectiveVersion, sortVersionsNewestFirst } from "./versi";

const version = (
  versionNumber: string,
  effectiveDate: string,
  status: VersionStatus,
): Version => ({ versionNumber, effectiveDate, status, changeSummary: null });

// DATA SINTETIS untuk uji.
const A = version("2024/2025", "2024-08-01", "DIGANTIKAN");
const B = version("2025/2026", "2025-08-01", "DIGANTIKAN");
const C = version("2026/2027", "2026-08-01", "SAH");
const D = version("2027/2028", "2027-08-01", "DRAF");
const E = version("X", "2026-09-01", "DIBATALKAN");

describe("findEffectiveVersion (F-03)", () => {
  it("(1) T sebelum versi pertama: tidak ada versi berlaku", () => {
    expect(findEffectiveVersion([A, B, C], "2024-07-31")).toBeUndefined();
  });

  it("(2) T tepat di tanggal berlaku: versi itu sudah berlaku", () => {
    expect(findEffectiveVersion([A, B, C], "2025-08-01")).toBe(B);
  });

  it("(3) T di antara dua versi: versi lama yang kini DIGANTIKAN", () => {
    const result = findEffectiveVersion([A, B, C], "2026-02-15");
    expect(result).toBe(B);
    expect(result?.status).toBe("DIGANTIKAN");
  });

  it("(4) T setelah versi terakhir: versi terakhir", () => {
    expect(findEffectiveVersion([A, B, C], "2030-01-01")).toBe(C);
  });

  it("(5) DRAF dan DIBATALKAN diabaikan", () => {
    expect(findEffectiveVersion([A, B, C, D, E], "2028-01-01")).toBe(C);
  });

  it("daftar kosong: tidak ada versi berlaku", () => {
    expect(findEffectiveVersion([], "2026-10-24")).toBeUndefined();
  });

  it("tanggal berlaku sama: versi yang muncul lebih dulu dipertahankan", () => {
    const first = version("baru", "2025-08-01", "SAH");
    const second = version("lama", "2025-08-01", "DIGANTIKAN");
    expect(findEffectiveVersion([first, second], "2025-08-01")).toBe(first);
  });
});

describe("sortVersionsNewestFirst", () => {
  it("mengurutkan dari yang terbaru tanpa mengubah array masukan", () => {
    const input = [A, C, B];
    expect(sortVersionsNewestFirst(input)).toEqual([C, B, A]);
    expect(input).toEqual([A, C, B]);
  });
});
