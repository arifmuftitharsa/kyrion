import { describe, expect, it } from "vitest";
import { todayInJakarta } from "./tanggal";

describe("todayInJakarta", () => {
  it("masih tanggal yang sama pada 23.59.59 WIB", () => {
    expect(todayInJakarta(new Date("2026-10-24T16:59:59Z"))).toBe("2026-10-24");
  });

  it("berganti tanggal tepat pada 00.00 WIB (17.00 UTC)", () => {
    expect(todayInJakarta(new Date("2026-10-24T17:00:00Z"))).toBe("2026-10-25");
  });
});
