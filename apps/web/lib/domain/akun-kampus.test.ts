import { describe, expect, it } from "vitest";
import { emailKampusSah, normalkanEmail } from "./akun-kampus";

describe("normalkanEmail", () => {
  it("trim lalu huruf kecil", () => {
    expect(normalkanEmail("  Uji.Coba@Contoh.TEST ")).toBe("uji.coba@contoh.test");
  });
});

describe("emailKampusSah", () => {
  it.each(["uji@universitaspertamina.ac.id", "uji@student.universitaspertamina.ac.id"])("menerima %s", (e) => {
    expect(emailKampusSah(e)).toBe(true);
  });

  it.each([
    ["akhiran palsu", "x@universitaspertamina.ac.id.evil.com"],
    ["awalan palsu", "x@evil-universitaspertamina.ac.id"],
    ["subdomain", "x@sub.student.universitaspertamina.ac.id"],
    ["belum normal (huruf besar)", "x@UniversitasPertamina.ac.id"],
    ["spasi tepi", " x@universitaspertamina.ac.id "],
    ["dua @", "x@y@universitaspertamina.ac.id"],
    ["lokal kosong", "@universitaspertamina.ac.id"],
    ["kosong", ""],
  ])("menolak: %s", (_nama, e) => {
    expect(emailKampusSah(e)).toBe(false);
  });
});
