import { describe, expect, it } from "vitest";
import { z } from "zod";

// Perbaikan Galat 1 (#7, Modul 7): z.coerce.boolean() memakai Boolean(), sehingga "false" terbaca true.
// z.stringbool() membaca teks "true" dan "false" sesuai artinya.
const skemaStatus = z.object({
  tersedia: z.stringbool(),
});

// Meniru data dari formulir: semua nilai FormData berupa string.
function dariFormulir(nilai: string) {
  const formData = new FormData();
  formData.set("tersedia", nilai);
  return skemaStatus.parse(Object.fromEntries(formData));
}

describe("skemaStatus (perbaikan Galat 1, #7)", () => {
  it('"true" menjadi true', () => {
    expect(dariFormulir("true").tersedia).toBe(true);
  });

  it('"false" menjadi false', () => {
    expect(dariFormulir("false").tersedia).toBe(false);
  });
});