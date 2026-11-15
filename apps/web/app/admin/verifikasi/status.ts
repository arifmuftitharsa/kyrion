import type { HasilVerifikasi } from "@/lib/crypto/hasil-verifikasi";

/** Keadaan form Periksa Berkas: galat unggahan, galat operasional umum, atau hasil verifikasi. */
export type StatusPeriksa = {
  galatBerkas?: string;
  pesan?: string;
  hasil?: HasilVerifikasi[];
};
