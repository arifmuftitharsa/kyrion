// Tipe dan teks hasil verifikasi berkas (F-33). AMAN UNTUK BROWSER: tanpa impor apa pun,
// dipakai komponen "use client". Jangan impor node:*, keyring, atau modul server di sini.

export type HasilVerifikasiKode = "asli-sah" | "asli-digantikan" | "tidak-cocok";

export type AlasanVerifikasi =
  | "berlaku"
  | "bukan-berlaku"
  | "berkas-tidak-dikenal"
  | "integritas-gagal"
  | "tanpa-tanda-tangan"
  | "kunci-tidak-sinkron"
  | "kunci-dicabut"
  | "kunci-dirotasi-sebelum-penandatanganan"
  | "kunci-sebelum-dibuat"
  | "tanda-tangan-tidak-valid";

export const JUDUL_HASIL: Record<HasilVerifikasiKode, string> = {
  "asli-sah": "Asli dan sah",
  "asli-digantikan": "Asli tetapi digantikan",
  "tidak-cocok": "Tidak cocok",
};

export const TEKS_ALASAN: Record<AlasanVerifikasi, string> = {
  berlaku: "Berkas asli dan sah: versi ini berlaku saat ini.",
  "bukan-berlaku": "Berkas asli, tetapi versi ini sudah digantikan versi yang lebih baru.",
  "berkas-tidak-dikenal": "Berkas tidak dikenal: tidak cocok dengan versi regulasi yang pernah disahkan.",
  "integritas-gagal": "Catatan versi gagal pemeriksaan integritas.",
  "tanpa-tanda-tangan": "Versi tidak bertanda tangan.",
  "kunci-tidak-sinkron": "Kunci tidak dikenal atau tidak sinkron.",
  "kunci-dicabut": "Kunci penandatangan sudah dicabut.",
  "kunci-dirotasi-sebelum-penandatanganan": "Pengesahan dilakukan setelah kunci dirotasi.",
  "kunci-sebelum-dibuat": "Pengesahan tercatat sebelum kunci dibuat.",
  "tanda-tangan-tidak-valid": "Tanda tangan tidak valid.",
};

/** Hanya metadata aman; status hanya pada hasil asli-*. */
export interface MetadataVersi {
  regulasi: string;
  nomorVersi: string;
  /** ISO "YYYY-MM-DD". */
  tanggalBerlaku: string;
  status?: "SAH" | "DIGANTIKAN";
}

export interface HasilVerifikasi {
  hasil: HasilVerifikasiKode;
  alasan: AlasanVerifikasi;
  /** Ada pada setiap hasil yang berasal dari kandidat; tidak ada pada berkas-tidak-dikenal tanpa kandidat. */
  versi?: MetadataVersi;
}
