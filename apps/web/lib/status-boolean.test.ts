import { describe, expect, it } from "vitest";
import { z } from "zod";

// Usulan AI (Modul 7, Galat 1): konversi tipe yang tampak masuk akal.
const skemaStatus = z.object({
  tersedia: z.stringbool(),
});

// Meniru data dari formulir: semua nilai FormData berupa string.
function dariFormulir(nilai: string) {
  const formData = new FormData();
  formData.set("tersedia", nilai);
  return skemaStatus.parse(Object.fromEntries(formData));
}

describe("skemaStatus (usulan AI)", () => {
  it('"true" menjadi true', () => {
    expect(dariFormulir("true").tersedia).toBe(true);
  });

  it('"false" menjadi false', () => {
    expect(dariFormulir("false").tersedia).toBe(false);
  });
});