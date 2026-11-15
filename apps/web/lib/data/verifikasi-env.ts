import "server-only";
import { bacaKeyring, KeyringTidakValid, type Keyring } from "@/lib/crypto/keyring";

/**
 * Keyring dari KYRION_KEYRING_FILE (akar kepercayaan kunci publik, di luar basis data).
 * Gagal tertutup: variabel belum diatur atau berkas rusak melempar KeyringTidakValid;
 * pemanggil memperlakukannya sebagai galat operasional, bukan hasil verifikasi.
 */
export async function bacaKeyringDariEnv(): Promise<Keyring> {
  const lokasi = process.env.KYRION_KEYRING_FILE;
  if (!lokasi) throw new KeyringTidakValid("lokasi berkas belum diatur");
  return bacaKeyring(lokasi);
}
