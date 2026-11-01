import "server-only";
import { dataTerlindungDariBaris } from "@/lib/crypto/data-terlindung";
import type { DataVersiTerlindung } from "@/lib/crypto/kanonis";
import { bacaKunciInduk } from "@/lib/crypto/kunci";
import { buatTagVersi } from "@/lib/crypto/mac";
import { IntegritasGagal, periksaIntegritasVersi } from "@/lib/crypto/verifikasi";
import type { BerkasTersimpan } from "@/lib/types";

// Sambungan F-31 ke aplikasi: satu-satunya tempat yang tahu lokasi kunci induk.
// Modul di lib/crypto/ tetap murni; di sini kunci dibaca dari environment.

let kunciInduk: Buffer | undefined;

/**
 * Kunci dibaca malas pada pemakaian pertama, bukan saat modul diimpor: build dan
 * halaman yang tidak menyentuh berkas tidak butuh kunci. Hanya hasil sukses yang
 * di-cache; kegagalan (berkas belum ada, izin salah) dicoba lagi pada panggilan
 * berikutnya, jadi memperbaiki berkas kunci tidak butuh restart server.
 */
async function muatKunciInduk(): Promise<Buffer> {
  kunciInduk ??= await bacaKunciInduk(process.env.KYRION_MASTER_KEY_FILE);
  return kunciInduk;
}

/** Tag untuk data versi yang akan ditulis ke DB. Melempar KunciTidakValid bila kunci tidak bisa dipakai. */
export async function tandatanganiVersi(data: DataVersiTerlindung): Promise<string> {
  return buatTagVersi(await muatKunciInduk(), data);
}

/**
 * Memeriksa berkas versi sebelum dikirim: hash isi berkas dan tag harus cocok.
 * Melempar IntegritasGagal atau KunciTidakValid; pemanggil memperlakukan keduanya
 * sebagai gagal tertutup.
 */
export async function periksaBerkasVersi(berkas: BerkasTersimpan, bytes: Uint8Array): Promise<void> {
  const data = dataTerlindungDariBaris({
    id: berkas.id,
    regulationId: berkas.regulationId,
    versionNumber: berkas.versionNumber,
    effectiveDate: berkas.effectiveDate,
    fileSha256: berkas.sha256,
    fileName: berkas.name,
    fileSize: berkas.size,
  });
  if (!data) throw new IntegritasGagal();
  periksaIntegritasVersi({ kunciInduk: await muatKunciInduk(), data, tag: berkas.tag, bytes });
}
