import { realpath, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SigningKeyStatus } from "@/generated/prisma/client";
import {
  bacaKeyring,
  cabutKunci,
  cariKunci,
  putarKunci,
  tambahKunciAktif,
  tulisKeyring,
  type EntriKunci,
  type Keyring,
} from "./keyring";
import { bangkitkanPasanganKunci } from "./tanda-tangan";

// Operasi operator kunci penandatangan (F-32, F-33): buat, putar, cabut. Setiap operasi
// mengubah berkas keyring DAN baris signing_keys. Modul ini tidak membaca variabel
// lingkungan dan tidak membuat klien DB; semua dependensi masuk lewat Konteks.

type StatusKeyring = EntriKunci["status"];

const KE_PRISMA = {
  aktif: "AKTIF",
  dirotasi: "DIROTASI",
  dicabut: "DICABUT",
} as const satisfies Record<StatusKeyring, SigningKeyStatus>;

const KE_KEYRING: Record<SigningKeyStatus, StatusKeyring> = {
  AKTIF: "aktif",
  DIROTASI: "dirotasi",
  DICABUT: "dicabut",
};

const FORMAT_ID = /^[0-9a-f]{32}$/;

/** Pesan hanya dari alasan tetap; isi kunci dan PEM tidak pernah masuk ke pesan galat. */
export class OperasiKunciGagal extends Error {
  constructor(alasan: string) {
    super(`Operasi kunci gagal: ${alasan}.`);
    this.name = "OperasiKunciGagal";
  }
}

/** Galat setelah keyring ditulis: hasil commit DB tidak diketahui. Tidak ada pemulihan otomatis. */
export class KeadaanTidakPasti extends OperasiKunciGagal {
  constructor() {
    super("keadaan tidak pasti: keyring sudah ditulis tetapi commit basis data gagal; sistem gagal tertutup");
    this.name = "KeadaanTidakPasti";
  }
}

export function statusKeyringKePrisma(status: string): SigningKeyStatus {
  if (!Object.hasOwn(KE_PRISMA, status)) throw new OperasiKunciGagal("status keyring tidak dikenal");
  return KE_PRISMA[status as StatusKeyring];
}

export function statusPrismaKeKeyring(status: string): StatusKeyring {
  if (!Object.hasOwn(KE_KEYRING, status)) throw new OperasiKunciGagal("status basis data tidak dikenal");
  return KE_KEYRING[status as SigningKeyStatus];
}

// Bentuk sempit yang dipakai dari klien Prisma, agar tes cukup memberi tiruan.
export interface BarisKunci {
  id: string;
  publicKey: Uint8Array<ArrayBuffer>;
  status: SigningKeyStatus;
  createdAt: Date;
}

export interface TxKunci {
  signingKey: {
    count(): Promise<number>;
    create(args: { data: BarisKunci }): Promise<unknown>;
    updateMany(args: {
      where: { id: string; status: SigningKeyStatus | { in: SigningKeyStatus[] } };
      data: { status: SigningKeyStatus; rotatedAt?: Date; revokedAt?: Date };
    }): Promise<{ count: number }>;
  };
}

export interface KlienKunci {
  $transaction<T>(fn: (tx: TxKunci) => Promise<T>): Promise<T>;
}

export interface Konteks {
  db: KlienKunci;
  berkasKeyring: string;
  /** Akar repository (working tree); berkas kunci dan keyring wajib di luarnya. */
  akarRepo: string;
  /** Dipanggil sekali per operasi agar stempel DB dan keyring identik. */
  jam: () => Date;
  /** Bisa disuntik untuk tes; bawaannya tulisKeyring asli. */
  tulisKeyring?: typeof tulisKeyring;
}

export interface HasilBuat {
  id: string;
  out: string;
  status: StatusKeyring;
}
export interface HasilPutar extends HasilBuat {
  idLama: string;
}
export interface HasilCabut {
  id: string;
  status: StatusKeyring;
  adaKunciAktifTersisa: boolean;
}

/**
 * Apakah `lokasi` berada di dalam `akar`. Awalan ".." saja tidak cukup: folder bernama
 * "..data" di dalam repository bukan di luar. Keduanya harus sudah absolut.
 */
export function didalamRepository(lokasi: string, akar: string): boolean {
  const relatif = path.relative(akar, lokasi);
  const diLuar = relatif === ".." || relatif.startsWith(`..${path.sep}`) || path.isAbsolute(relatif);
  return !diLuar;
}

/** Jalur absolut dengan folder induk di-realpath (menutup symlink); wajib di luar repo. Berkas belum harus ada. */
async function lokasiLuarRepo(lokasi: string, akarRepo: string, nama: string): Promise<string> {
  let induk: string;
  let akar: string;
  try {
    induk = await realpath(path.dirname(path.resolve(lokasi)));
    akar = await realpath(path.resolve(akarRepo));
  } catch {
    throw new OperasiKunciGagal(`folder ${nama} tidak ditemukan`);
  }
  const nyata = path.join(induk, path.basename(lokasi));
  if (didalamRepository(nyata, akar)) throw new OperasiKunciGagal(`${nama} berada di dalam repository`);
  return nyata;
}

/** Hanya ENOENT berarti "belum ada"; galat lain ditolak. */
async function bacaKeyringAtauKosong(lokasi: string): Promise<{ keyring: Keyring; ada: boolean }> {
  try {
    await stat(lokasi);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { keyring: { versi: 1, kunci: [] }, ada: false };
    }
    throw new OperasiKunciGagal("berkas keyring tidak dapat diperiksa");
  }
  return { keyring: await bacaKeyring(lokasi), ada: true };
}

/** Flag "wx": gagal bila berkas sudah ada, tidak pernah menimpa. */
async function tulisPrivatBaru(lokasi: string, pem: string): Promise<void> {
  try {
    await writeFile(lokasi, pem, { flag: "wx", mode: 0o600 });
  } catch (error) {
    const kode = (error as NodeJS.ErrnoException).code;
    if (kode === "EEXIST") throw new OperasiKunciGagal("berkas kunci privat sudah ada dan tidak ditimpa");
    throw new OperasiKunciGagal(`berkas kunci privat gagal dibuat (kode: ${kode ?? "tidak diketahui"})`);
  }
}

function barisBaru(entri: EntriKunci, kunciPublikDer: Uint8Array, waktu: Date): BarisKunci {
  return {
    id: entri.id,
    publicKey: new Uint8Array(kunciPublikDer),
    status: statusKeyringKePrisma(entri.status),
    createdAt: waktu,
  };
}

/**
 * Perubahan DB dan penulisan keyring dalam satu transaksi; keyring ditulis TERAKHIR.
 * Bila gagal sebelum keyring ditulis, transaksi di-rollback dan galat asli diteruskan.
 * Bila gagal sesudahnya (commit), hasilnya tidak pasti: KeadaanTidakPasti.
 */
async function terapkan(
  k: Konteks,
  berkasKeyring: string,
  keyringBaru: Keyring,
  ubahDb: (tx: TxKunci) => Promise<void>,
): Promise<void> {
  const tulis = k.tulisKeyring ?? tulisKeyring;
  let keyringDitulis = false;
  try {
    await k.db.$transaction(async (tx) => {
      await ubahDb(tx);
      await tulis(berkasKeyring, keyringBaru);
      keyringDitulis = true;
    });
  } catch (error) {
    if (keyringDitulis) throw new KeadaanTidakPasti();
    throw error;
  }
}

/** Menghapus berkas privat milik proses ini bila gagal SEBELUM keyring ditulis. */
async function denganPembersihan(out: string, kerja: () => Promise<void>): Promise<void> {
  try {
    await kerja();
  } catch (error) {
    if (!(error instanceof KeadaanTidakPasti)) {
      try {
        await rm(out, { force: true });
      } catch {
        // Best effort: galat rm tidak boleh menggantikan galat asli.
      }
    }
    throw error;
  }
}

async function siapkanLokasi(k: Konteks, out: string): Promise<{ out: string; berkasKeyring: string }> {
  const nyataOut = await lokasiLuarRepo(out, k.akarRepo, "--out");
  const berkasKeyring = await lokasiLuarRepo(k.berkasKeyring, k.akarRepo, "keyring");
  if (nyataOut === berkasKeyring) throw new OperasiKunciGagal("--out sama dengan berkas keyring");
  return { out: nyataOut, berkasKeyring };
}

export async function buatKunci(k: Konteks, o: { out: string }): Promise<HasilBuat> {
  const { out, berkasKeyring } = await siapkanLokasi(k, o.out);
  const { keyring, ada } = await bacaKeyringAtauKosong(berkasKeyring);
  const waktu = k.jam();
  const pasangan = bangkitkanPasanganKunci();
  const keyringBaru = tambahKunciAktif(keyring, pasangan.kunciPublikDer, waktu);
  const entri = keyringBaru.kunci[keyringBaru.kunci.length - 1];

  await tulisPrivatBaru(out, pasangan.kunciPrivatPem);
  await denganPembersihan(out, () =>
    terapkan(k, berkasKeyring, keyringBaru, async (tx) => {
      // Keyring hilang tetapi tabel berisi: jangan menyambung, keduanya harus cocok.
      if (!ada && (await tx.signingKey.count()) !== 0) {
        throw new OperasiKunciGagal("keyring belum ada tetapi tabel signing_keys tidak kosong");
      }
      await tx.signingKey.create({ data: barisBaru(entri, pasangan.kunciPublikDer, waktu) });
    }),
  );
  return { id: entri.id, out, status: entri.status };
}

export async function putarKunciOperator(k: Konteks, o: { out: string }): Promise<HasilPutar> {
  const { out, berkasKeyring } = await siapkanLokasi(k, o.out);
  const keyring = await bacaKeyring(berkasKeyring);
  const waktu = k.jam();
  const pasangan = bangkitkanPasanganKunci();
  const keyringBaru = putarKunci(keyring, pasangan.kunciPublikDer, waktu);
  // putarKunci sudah menjamin tepat satu kunci aktif lama.
  const lama = keyring.kunci.find((e) => e.status === "aktif") as EntriKunci;
  const entri = keyringBaru.kunci[keyringBaru.kunci.length - 1];

  await tulisPrivatBaru(out, pasangan.kunciPrivatPem);
  await denganPembersihan(out, () =>
    terapkan(k, berkasKeyring, keyringBaru, async (tx) => {
      // Urutan wajib: baris lama keluar dari AKTIF dulu (partial unique index), baru baris baru masuk.
      const { count } = await tx.signingKey.updateMany({
        where: { id: lama.id, status: statusKeyringKePrisma("aktif") },
        data: { status: statusKeyringKePrisma("dirotasi"), rotatedAt: waktu },
      });
      if (count !== 1) throw new OperasiKunciGagal("kunci aktif di basis data tidak cocok dengan keyring");
      await tx.signingKey.create({ data: barisBaru(entri, pasangan.kunciPublikDer, waktu) });
    }),
  );
  return { id: entri.id, idLama: lama.id, out, status: entri.status };
}

export async function cabutKunciOperator(k: Konteks, o: { id: string }): Promise<HasilCabut> {
  if (!FORMAT_ID.test(o.id)) throw new OperasiKunciGagal("id kunci harus 32 karakter hex huruf kecil");
  const berkasKeyring = await lokasiLuarRepo(k.berkasKeyring, k.akarRepo, "keyring");
  const keyring = await bacaKeyring(berkasKeyring);
  const waktu = k.jam();
  const keyringBaru = cabutKunci(keyring, o.id, waktu);
  const target = cariKunci(keyringBaru, o.id) as EntriKunci;

  await terapkan(k, berkasKeyring, keyringBaru, async (tx) => {
    const { count } = await tx.signingKey.updateMany({
      where: { id: o.id, status: { in: [statusKeyringKePrisma("aktif"), statusKeyringKePrisma("dirotasi")] } },
      data: { status: statusKeyringKePrisma("dicabut"), revokedAt: waktu },
    });
    if (count !== 1) throw new OperasiKunciGagal("kunci di basis data tidak cocok dengan keyring");
  });
  return {
    id: target.id,
    status: target.status,
    adaKunciAktifTersisa: keyringBaru.kunci.some((e) => e.status === "aktif"),
  };
}
