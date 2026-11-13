import "server-only";
import { buatPengirim } from "./konfigurasi";
import type { PengirimEmail } from "./pengirim";

// Titik masuk tunggal ke env untuk pustaka email: satu-satunya berkas di lib/email
// yang membaca process.env. Modul lain tetap murni dan menerima env sebagai parameter.

let pengirim: PengirimEmail | undefined;

/**
 * Dibuat malas pada pemanggilan pertama, bukan saat impor, agar build tidak butuh env.
 * Hanya hasil sukses yang di-cache; GalatKonfigurasiEmail dilempar apa adanya dan
 * dicoba lagi pada panggilan berikutnya, jadi memperbaiki env tidak butuh cache dibersihkan.
 */
export function getPengirimEmail(): PengirimEmail {
  pengirim ??= buatPengirim(process.env, { fetch });
  return pengirim;
}
