import { createPublicKey, randomBytes } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { z } from "zod";
import { idKunci } from "./tanda-tangan";

// Keyring F-32/F-33: berkas JSON berisi HANYA kunci publik beserta siklus hidupnya
// (aktif, dirotasi, dicabut). Modul ini tidak membaca variabel lingkungan; lokasi
// berkas selalu diberikan pemanggil. Fungsi siklus murni: masukan tidak diubah.

const STATUS = ["aktif", "dirotasi", "dicabut"] as const;

const skemaEntri = z.strictObject({
  id: z.string().regex(/^[0-9a-f]{32}$/),
  kunciPublik: z.string().min(1),
  status: z.enum(STATUS),
  dibuatPada: z.iso.datetime(),
  dirotasiPada: z.iso.datetime().nullable(),
  dicabutPada: z.iso.datetime().nullable(),
});

const skemaKeyring = z.strictObject({
  versi: z.literal(1),
  kunci: z.array(skemaEntri),
});

export type EntriKunci = z.infer<typeof skemaEntri>;
export type Keyring = z.infer<typeof skemaKeyring>;

/** Pesan hanya dari alasan tetap; isi berkas dan isi kunci tidak pernah masuk ke pesan galat. */
export class KeyringTidakValid extends Error {
  constructor(alasan: string) {
    super(`Keyring tidak valid: ${alasan}.`);
    this.name = "KeyringTidakValid";
  }
}

/** SPKI DER Ed25519 dari teks base64 ketat; null bila bukan. */
function dekodeKunciPublik(base64: string): Buffer | null {
  const der = Buffer.from(base64, "base64");
  // Buffer.from(..., "base64") diam-diam melewati karakter tidak valid; round-trip menangkapnya.
  if (der.toString("base64") !== base64) return null;
  try {
    const kunci = createPublicKey({ key: der, format: "der", type: "spki" });
    return kunci.asymmetricKeyType === "ed25519" ? der : null;
  } catch {
    return null;
  }
}

function periksaStempel(e: EntriKunci): void {
  const sah =
    e.status === "aktif"
      ? e.dirotasiPada === null && e.dicabutPada === null
      : e.status === "dirotasi"
        ? e.dirotasiPada !== null
        : e.dicabutPada !== null;
  if (!sah) throw new KeyringTidakValid(`stempel waktu tidak sesuai status "${e.status}"`);
}

/** Aturan di luar bentuk JSON. Gagal tertutup: galat pertama langsung dilempar. */
function periksaAturan(keyring: Keyring): void {
  const idTerlihat = new Set<string>();
  let jumlahAktif = 0;
  for (const e of keyring.kunci) {
    const der = dekodeKunciPublik(e.kunciPublik);
    if (!der) throw new KeyringTidakValid("kunciPublik bukan SPKI Ed25519 yang sah");
    if (e.id !== idKunci(der)) throw new KeyringTidakValid("id tidak cocok dengan kunciPublik");
    if (idTerlihat.has(e.id)) throw new KeyringTidakValid("id ganda");
    idTerlihat.add(e.id);
    periksaStempel(e);
    if (e.status === "aktif") jumlahAktif += 1;
  }
  if (jumlahAktif > 1) throw new KeyringTidakValid("lebih dari satu kunci aktif");
}

/** Memvalidasi objek (bentuk dan aturan) lalu mengembalikannya; melempar KeyringTidakValid. */
function validasi(nilai: unknown): Keyring {
  const hasil = skemaKeyring.safeParse(nilai);
  if (!hasil.success) {
    const lokasi = hasil.error.issues.map((i) => i.path.join(".") || "(akar)").join(", ");
    throw new KeyringTidakValid(`struktur tidak sah di ${lokasi}`);
  }
  periksaAturan(hasil.data);
  return hasil.data;
}

export function parseKeyring(teks: string): Keyring {
  let nilai: unknown;
  try {
    nilai = JSON.parse(teks);
  } catch {
    throw new KeyringTidakValid("bukan JSON");
  }
  return validasi(nilai);
}

/** Berkas tidak ada atau rusak adalah galat, tidak pernah dianggap keyring kosong. */
export async function bacaKeyring(lokasi: string): Promise<Keyring> {
  let teks: string;
  try {
    teks = await readFile(lokasi, "utf8");
  } catch {
    throw new KeyringTidakValid("berkas tidak dapat dibaca");
  }
  return parseKeyring(teks);
}

/**
 * Tulis atomik: berkas sementara di folder yang sama lalu rename, sehingga pembaca
 * tidak pernah melihat berkas setengah jadi. Mode 0o600 berlaku di POSIX; Windows
 * tidak punya bit izin POSIX, jadi mode diabaikan di sana. Keyring hanya berisi
 * kunci publik, jadi izin di sini defensif, bukan kerahasiaan.
 */
export async function tulisKeyring(lokasi: string, keyring: Keyring): Promise<void> {
  const sah = validasi(keyring);
  const sementara = `${lokasi}.${randomBytes(6).toString("hex")}.tmp`;
  try {
    await writeFile(sementara, `${JSON.stringify(sah, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    await rename(sementara, lokasi);
  } catch (error) {
    await rm(sementara, { force: true });
    throw error;
  }
}

function entriBaru(kunciPublikDer: Uint8Array, waktu: Date): EntriKunci {
  const der = Buffer.from(kunciPublikDer);
  const base64 = der.toString("base64");
  if (!dekodeKunciPublik(base64)) throw new KeyringTidakValid("kunciPublik bukan SPKI Ed25519 yang sah");
  return {
    id: idKunci(der),
    kunciPublik: base64,
    status: "aktif",
    dibuatPada: waktu.toISOString(),
    dirotasiPada: null,
    dicabutPada: null,
  };
}

export function tambahKunciAktif(keyring: Keyring, kunciPublikDer: Uint8Array, waktu: Date): Keyring {
  if (keyring.kunci.some((e) => e.status === "aktif")) {
    throw new KeyringTidakValid("sudah ada kunci aktif");
  }
  return validasi({ ...keyring, kunci: [...keyring.kunci, entriBaru(kunciPublikDer, waktu)] });
}

export function putarKunci(keyring: Keyring, kunciBaruDer: Uint8Array, waktu: Date): Keyring {
  if (!keyring.kunci.some((e) => e.status === "aktif")) {
    throw new KeyringTidakValid("tidak ada kunci aktif untuk diputar");
  }
  const lama = keyring.kunci.map((e): EntriKunci =>
    e.status === "aktif" ? { ...e, status: "dirotasi", dirotasiPada: waktu.toISOString() } : e,
  );
  return validasi({ ...keyring, kunci: [...lama, entriBaru(kunciBaruDer, waktu)] });
}

export function cabutKunci(keyring: Keyring, id: string, waktu: Date): Keyring {
  const target = cariKunci(keyring, id);
  if (!target) throw new KeyringTidakValid("id kunci tidak dikenal");
  if (target.status === "dicabut") throw new KeyringTidakValid("kunci sudah dicabut");
  const kunci = keyring.kunci.map((e): EntriKunci =>
    e.id === id ? { ...e, status: "dicabut", dicabutPada: waktu.toISOString() } : e,
  );
  return validasi({ ...keyring, kunci });
}

export function cariKunci(keyring: Keyring, id: string): EntriKunci | undefined {
  return keyring.kunci.find((e) => e.id === id);
}

export type AlasanTolak = "dicabut" | "dirotasi-sebelum-penandatanganan" | "sebelum-dibuat";

export type HasilVerifikasiKunci = { boleh: true } | { boleh: false; alasan: AlasanTolak };

/**
 * Apakah kunci sah dipakai memverifikasi pengesahan pada approvedAt. Dicabut selalu
 * ditolak; dirotasi hanya untuk pengesahan sampai dirotasiPada (inklusif); semua
 * status menolak pengesahan sebelum kunci dibuat.
 */
export function kunciBolehMemverifikasi(entri: EntriKunci, approvedAt: Date): HasilVerifikasiKunci {
  if (entri.status === "dicabut") return { boleh: false, alasan: "dicabut" };
  const waktu = approvedAt.getTime();
  if (waktu < Date.parse(entri.dibuatPada)) return { boleh: false, alasan: "sebelum-dibuat" };
  if (entri.status === "dirotasi" && entri.dirotasiPada !== null && waktu > Date.parse(entri.dirotasiPada)) {
    return { boleh: false, alasan: "dirotasi-sebelum-penandatanganan" };
  }
  return { boleh: true };
}
