import { describe, expect, it } from "vitest";
import { formatUkuranBerkas } from "./format";

describe("formatUkuranBerkas", () => {
  it.each([
    [500, "500 B"],
    [358_400, "350 KB"],
    [1_258_291, "1,2 MB"],
    [10 * 1024 * 1024, "10 MB"],
  ])("%i byte menjadi %s", (bytes, expected) => {
    expect(formatUkuranBerkas(bytes)).toBe(expected);
  });
});
