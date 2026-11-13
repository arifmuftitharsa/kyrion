import { describe, expect, it } from "vitest";
import { emailAdminSeed, emailKampusSah, normalkanEmail } from "./akun-kampus";

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

describe("emailAdminSeed", () => {
  const PESAN = "ADMIN_SEED_EMAIL wajib diisi dengan alamat email kampus yang sah";

  it.each([
    ["undefined", undefined],
    ["kosong", ""],
    ["hanya spasi", "   "],
    ["domain luar", "admin.uji.kyrion@contoh.test"],
    ["akhiran palsu", "admin.uji.kyrion@universitaspertamina.ac.id.evil.test"],
    ["awalan palsu", "admin.uji.kyrion@evil-universitaspertamina.ac.id"],
    ["subdomain", "admin.uji.kyrion@sub.student.universitaspertamina.ac.id"],
  ])("menolak: %s", (_nama, mentah) => {
    expect(() => emailAdminSeed(mentah)).toThrow(PESAN);
  });

  it("menormalkan huruf besar dan spasi lalu menerima", () => {
    expect(emailAdminSeed("  Admin.Uji.Kyrion@Universitaspertamina.AC.ID ")).toBe(
      "admin.uji.kyrion@universitaspertamina.ac.id",
    );
    expect(emailAdminSeed("mahasiswa.uji.kyrion@student.universitaspertamina.ac.id")).toBe(
      "mahasiswa.uji.kyrion@student.universitaspertamina.ac.id",
    );
  });

  it("pesan galat tidak memuat nilai masukan", () => {
    let pesan = "";
    try {
      emailAdminSeed("rahasia.xyz@contoh.test");
    } catch (e) {
      pesan = (e as Error).message;
    }
    expect(pesan).toBe(PESAN);
    expect(pesan).not.toContain("rahasia");
  });
});
