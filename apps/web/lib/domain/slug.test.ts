import { describe, expect, it } from "vitest";
import { createSlug } from "./slug";

describe("createSlug", () => {
  it.each([
    ["nama biasa", "Pedoman Akademik", "pedoman-akademik"],
    ["aksen dibuang, spasi dan simbol jadi satu strip", "Peraturan Rèktor  2025!", "peraturan-rektor-2025"],
    ["tanpa strip di awal dan akhir", "  --Tata__Tertib--  ", "tata-tertib"],
    ["tanpa huruf atau angka menghasilkan string kosong", "!!!!!", ""],
  ])("%s", (_label, name, expected) => {
    expect(createSlug(name)).toBe(expected);
  });
});
