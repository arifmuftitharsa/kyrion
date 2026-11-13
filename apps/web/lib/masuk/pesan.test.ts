import { describe, expect, it } from "vitest";
import { petakanGalatMasuk } from "./pesan";

const UMUM = "Terjadi kesalahan. Coba lagi.";
const TUNGGU = "Terlalu banyak percobaan. Tunggu sekitar satu menit lalu coba lagi.";

describe("petakanGalatMasuk", () => {
  it.each([
    [{ status: 400, kode: "EMAIL_BUKAN_KAMPUS" }, "Gunakan email kampus."],
    [{ status: 400, kode: "TIPE_OTP_TIDAK_DIDUKUNG" }, UMUM],
    [{ status: 429, kode: "JEDA_OTP" }, TUNGGU],
    [{ status: 403, kode: "AKUN_TIDAK_AKTIF" }, UMUM],
    [{ status: 400, kode: "INVALID_OTP" }, "Kode salah atau sudah kedaluwarsa."],
    [{ status: 400, kode: "OTP_EXPIRED" }, "Kode salah atau sudah kedaluwarsa."],
    [{ status: 403, kode: "TOO_MANY_ATTEMPTS" }, "Percobaan habis. Minta kode baru."],
    [{ status: 429 }, TUNGGU], // pembatas laju bawaan, tanpa kode
    [{ status: 400 }, UMUM], // 400 tanpa kode
    [{ status: 500 }, UMUM],
    [{ status: 400, kode: "KODE_ASING" }, UMUM],
    ["jaringan", UMUM],
  ] as const)("%j -> %s", (galat, pesan) => {
    expect(petakanGalatMasuk(galat)).toBe(pesan);
  });

  it("kode dari server yang dikenal tetap menang atas status", () => {
    expect(petakanGalatMasuk({ status: 500, kode: "INVALID_OTP" })).toBe(
      "Kode salah atau sudah kedaluwarsa.",
    );
  });
});
