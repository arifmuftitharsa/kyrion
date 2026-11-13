// Pemetaan galat respons Better Auth ke pesan untuk pengguna. Murni; pesan mentah server
// tidak pernah dipakai. Kode plugin email OTP: dist/plugins/email-otp/error-codes.mjs.
import { KODE_GALAT } from "@/lib/auth/kode-galat";

export type GalatMasuk = { status: number; kode?: string } | "jaringan";

export const PESAN_KODE_TERKIRIM = "Jika alamat dapat menerima email, kode sudah dikirim.";

const PESAN_UMUM = "Terjadi kesalahan. Coba lagi.";
const PESAN_TUNGGU = "Terlalu banyak percobaan. Tunggu sekitar satu menit lalu coba lagi.";

export function petakanGalatMasuk(galat: GalatMasuk): string {
  if (galat === "jaringan") return PESAN_UMUM;
  switch (galat.kode) {
    case KODE_GALAT.EMAIL_BUKAN_KAMPUS.code:
      return KODE_GALAT.EMAIL_BUKAN_KAMPUS.message;
    case KODE_GALAT.JEDA_OTP.code:
      return PESAN_TUNGGU;
    case "INVALID_OTP":
    case "OTP_EXPIRED":
      return "Kode salah atau sudah kedaluwarsa.";
    case "TOO_MANY_ATTEMPTS":
      return "Percobaan habis. Minta kode baru.";
    case undefined:
      // Pembatas laju bawaan membalas 429 tanpa kode.
      return galat.status === 429 ? PESAN_TUNGGU : PESAN_UMUM;
    default:
      return PESAN_UMUM; // termasuk AKUN_TIDAK_AKTIF: tidak membocorkan status akun
  }
}
