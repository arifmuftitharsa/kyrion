import { describe, expect, it } from "vitest";
import { buatPengirimMemori } from "./memori";

const a = { penerima: "a@contoh.test", subjek: "S1", teks: "T1" };
const b = { penerima: "b@contoh.test", subjek: "S2", teks: "T2" };

describe("buatPengirimMemori", () => {
  it("menyimpan pesan terkirim sesuai urutan dan bisa dibaca ulang", async () => {
    const pengirim = buatPengirimMemori();
    await expect(pengirim.kirim(a)).resolves.toBeUndefined();
    await pengirim.kirim(b);
    expect(pengirim.pesan).toEqual([a, b]);
    expect(pengirim.pesan).toEqual([a, b]);
  });

  it("kosongkan() menghapus semua pesan", async () => {
    const pengirim = buatPengirimMemori();
    await pengirim.kirim(a);
    pengirim.kosongkan();
    expect(pengirim.pesan).toEqual([]);
    await pengirim.kirim(b);
    expect(pengirim.pesan).toEqual([b]);
  });
});
