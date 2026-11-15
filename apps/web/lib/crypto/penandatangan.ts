import { createPrivateKey, createPublicKey, type KeyObject } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { bacaKeyring, cariKunci } from "./keyring";
import { idKunci } from "./tanda-tangan";

// Pemuat kunci privat penandatangan (F-32). Seperti kunci.ts, modul ini tidak
// membaca variabel lingkungan; lokasi berkas selalu diberikan pemanggil.

/** Pesan hanya dari alasan tetap; isi berkas dan PEM tidak pernah masuk ke pesan galat. */
export class PenandatanganTidakValid extends Error {
  constructor(alasan: string) {
    super(`Penandatangan tidak valid: ${alasan}.`);
    this.name = "PenandatanganTidakValid";
  }
}

/**
 * Membaca kunci privat Ed25519 dari berkas PEM. Di POSIX, berkas yang bisa diakses
 * grup atau pengguna lain ditolak. Windows tidak punya bit izin POSIX (mode yang
 * dilaporkan tidak berarti), jadi pemeriksaan dilewati di sana.
 */
export async function muatKunciPrivat(lokasi: string | undefined): Promise<KeyObject> {
  if (!lokasi) throw new PenandatanganTidakValid("lokasi berkas kunci privat belum diatur");

  let pem: string;
  try {
    if (process.platform !== "win32") {
      const { mode } = await stat(lokasi);
      if ((mode & 0o077) !== 0) {
        throw new PenandatanganTidakValid("izin berkas kunci privat terlalu longgar");
      }
    }
    pem = await readFile(lokasi, "utf8");
  } catch (error) {
    if (error instanceof PenandatanganTidakValid) throw error;
    throw new PenandatanganTidakValid("berkas kunci privat tidak dapat dibaca");
  }

  let kunci: KeyObject;
  try {
    kunci = createPrivateKey(pem);
  } catch {
    // Pesan bawaan OpenSSL bisa memuat potongan masukan; sengaja tidak diteruskan.
    throw new PenandatanganTidakValid("kunci privat bukan PEM yang sah");
  }
  if (kunci.asymmetricKeyType !== "ed25519") {
    throw new PenandatanganTidakValid("kunci privat bukan Ed25519");
  }
  return kunci;
}

export interface Penandatangan {
  kunciPrivat: KeyObject;
  idKunci: string;
}

/** Hanya mengembalikan penandatangan bila kunci privatnya ada di keyring dan berstatus aktif. */
export async function siapkanPenandatangan(opsi: {
  berkasKunciPrivat: string | undefined;
  berkasKeyring: string | undefined;
}): Promise<Penandatangan> {
  if (!opsi.berkasKeyring) throw new PenandatanganTidakValid("lokasi berkas keyring belum diatur");
  const kunciPrivat = await muatKunciPrivat(opsi.berkasKunciPrivat);
  const kunciPublikDer = createPublicKey(kunciPrivat).export({ type: "spki", format: "der" });
  const id = idKunci(kunciPublikDer);

  const entri = cariKunci(await bacaKeyring(opsi.berkasKeyring), id);
  if (!entri) throw new PenandatanganTidakValid("kunci privat tidak terdaftar di keyring");
  if (entri.status !== "aktif") throw new PenandatanganTidakValid(`kunci berstatus "${entri.status}", bukan aktif`);
  return { kunciPrivat, idKunci: id };
}
