import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

// DATA SINTETIS untuk uji; bukan kata sandi sungguhan.
const SANDI = "kuda-baterai-staples-benar";

/** Ganti satu karakter base64 dengan karakter base64 lain (tetap format sah). */
function ubahSatuKarakter(text: string, index: number): string {
  const pengganti = text[index] === "A" ? "B" : "A";
  return text.slice(0, index) + pengganti + text.slice(index + 1);
}

describe("hashPassword dan verifyPassword", () => {
  it("menerima kata sandi yang benar", async () => {
    const stored = await hashPassword(SANDI);
    expect(await verifyPassword(SANDI, stored)).toBe(true);
  });

  it("menolak kata sandi yang salah", async () => {
    const stored = await hashPassword(SANDI);
    expect(await verifyPassword("kata-sandi-lain", stored)).toBe(false);
  });

  it("menghasilkan hash berbeda untuk kata sandi sama (salt acak)", async () => {
    const [a, b] = await Promise.all([hashPassword(SANDI), hashPassword(SANDI)]);
    expect(a).not.toBe(b);
    expect(await verifyPassword(SANDI, a)).toBe(true);
    expect(await verifyPassword(SANDI, b)).toBe(true);
  });

  it("memakai format scrypt$N$r$p$salt$hash dengan parameter opsi B", async () => {
    const stored = await hashPassword(SANDI);
    expect(stored).toMatch(/^scrypt\$65536\$8\$2\$[A-Za-z0-9+/]+={0,2}\$[A-Za-z0-9+/]+={0,2}$/);
    const [, , , , salt, hash] = stored.split("$");
    expect(Buffer.from(salt, "base64")).toHaveLength(16);
    expect(Buffer.from(hash, "base64")).toHaveLength(32);
  });

  it("menolak hash yang diubah satu karakter", async () => {
    const stored = await hashPassword(SANDI);
    const dirusak = ubahSatuKarakter(stored, stored.length - 5);
    expect(dirusak).not.toBe(stored);
    expect(await verifyPassword(SANDI, dirusak)).toBe(false);
  });

  it("tetap memverifikasi hash dengan parameter lain (dibaca dari string)", async () => {
    const stored = await hashPassword(SANDI, { N: 2 ** 14, r: 8, p: 5, keyLength: 32 });
    expect(stored.startsWith("scrypt$16384$8$5$")).toBe(true);
    expect(await verifyPassword(SANDI, stored)).toBe(true);
  });
});

describe("verifyPassword gagal tertutup untuk format rusak", () => {
  const SALT = Buffer.alloc(16, 1).toString("base64");
  const HASH = Buffer.alloc(32, 2).toString("base64");

  it.each([
    ["string kosong", ""],
    ["bukan format", "abc"],
    ["algoritma lain", `bcrypt$65536$8$2$${SALT}$${HASH}`],
    ["jumlah bagian kurang", `scrypt$65536$8$2$${SALT}`],
    ["salt bukan base64", `scrypt$65536$8$2$salt!!$${HASH}`],
    ["N bukan angka", `scrypt$abc$8$2$${SALT}$${HASH}`],
    ["N bukan pangkat dua", `scrypt$3$8$2$${SALT}$${HASH}`],
    ["N di luar batas (2^30)", `scrypt$${2 ** 30}$8$2$${SALT}$${HASH}`],
    ["salt terlalu pendek", `scrypt$65536$8$2$${Buffer.alloc(4).toString("base64")}$${HASH}`],
  ])("%s menghasilkan false", async (_label, stored) => {
    await expect(verifyPassword(SANDI, stored)).resolves.toBe(false);
  });
});
