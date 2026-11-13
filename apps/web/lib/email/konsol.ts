import { bolehMemoriDanKonsol, GalatPengirimEmail, type PengirimEmail } from "./pengirim";

/**
 * Mencetak pesan ke log (isinya bisa berupa OTP), maka dilarang di luar
 * development/test: menolak sebelum mencetak apa pun.
 */
export function buatPengirimKonsol(
  nodeEnv: string | undefined,
  cetak: (baris: string) => void = console.log,
): PengirimEmail {
  return {
    async kirim(pesan) {
      if (!bolehMemoriDanKonsol(nodeEnv)) throw new GalatPengirimEmail("TIDAK_DIIZINKAN");
      cetak(`[email] Kepada: ${pesan.penerima}\n[email] Subjek: ${pesan.subjek}\n${pesan.teks}`);
    },
  };
}
