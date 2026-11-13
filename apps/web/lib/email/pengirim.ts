// Kontrak pengirim email: satu antarmuka, galat bertipe, tanpa ketergantungan ke
// adapter. Galat sengaja hanya membawa alasan dan status HTTP: isi email dapat
// berupa OTP, dan token/alamat tidak boleh bocor lewat pesan galat atau log.

export interface PesanEmail {
  penerima: string;
  subjek: string;
  teks: string;
}

export interface PengirimEmail {
  /** Selesai tanpa nilai = terkirim; gagal = melempar GalatPengirimEmail. */
  kirim(pesan: PesanEmail): Promise<void>;
}

export type AlasanGalatEmail =
  | "TOKEN_DITOLAK"
  | "KUOTA_ATAU_LAJU"
  | "STATUS_GAGAL"
  | "RESPONS_TIDAK_SESUAI"
  | "WAKTU_HABIS"
  | "JARINGAN"
  | "TIDAK_DIIZINKAN";

export class GalatPengirimEmail extends Error {
  constructor(
    readonly alasan: AlasanGalatEmail,
    readonly status?: number,
  ) {
    super(status === undefined ? alasan : `${alasan} (HTTP ${status})`);
    this.name = "GalatPengirimEmail";
  }
}

/** Memori dan konsol hanya untuk development/test; nilai lain (termasuk kosong) ditolak. */
export function bolehMemoriDanKonsol(nodeEnv: string | undefined): boolean {
  return nodeEnv === "development" || nodeEnv === "test";
}
