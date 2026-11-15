import "server-only";
import { KeyringTidakValid } from "@/lib/crypto/keyring";
import { PenandatanganTidakValid, siapkanPenandatangan, type Penandatangan } from "@/lib/crypto/penandatangan";
import { PenandatanganBelumSiapError, PESAN_KUNCI_BELUM_SIAP } from "@/lib/domain/versi-admin";

/**
 * Satu-satunya tempat KYRION_SIGNING_KEY_FILE dan KYRION_KEYRING_FILE dibaca. Gagal tertutup:
 * hanya dua galat penandatangan yang dibungkus (pesan tetap, tanpa jalur berkas); lainnya diteruskan.
 */
export async function siapkanPenandatanganDariEnv(): Promise<Penandatangan> {
  try {
    return await siapkanPenandatangan({
      berkasKunciPrivat: process.env.KYRION_SIGNING_KEY_FILE,
      berkasKeyring: process.env.KYRION_KEYRING_FILE,
    });
  } catch (error) {
    if (error instanceof PenandatanganTidakValid || error instanceof KeyringTidakValid) {
      throw new PenandatanganBelumSiapError(PESAN_KUNCI_BELUM_SIAP, { cause: error });
    }
    throw error;
  }
}
