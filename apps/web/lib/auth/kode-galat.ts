// Kode galat milik kita. Bentuk {code, message} sama dengan RawError yang diterima
// APIError.from di Better Auth, sehingga isi respons membawa field "code".
// Murni: dipakai server (lib/auth/index.ts) dan klien (lib/masuk/pesan.ts).

export const KODE_GALAT = {
  EMAIL_BUKAN_KAMPUS: { code: "EMAIL_BUKAN_KAMPUS", message: "Gunakan email kampus." },
  TIPE_OTP_TIDAK_DIDUKUNG: { code: "TIPE_OTP_TIDAK_DIDUKUNG", message: "Tipe OTP tidak didukung." },
  JEDA_OTP: { code: "JEDA_OTP", message: "Tunggu sebelum meminta kode lagi." },
  AKUN_TIDAK_AKTIF: { code: "AKUN_TIDAK_AKTIF", message: "Akun tidak aktif." },
} as const;

export type KodeGalat = keyof typeof KODE_GALAT;
