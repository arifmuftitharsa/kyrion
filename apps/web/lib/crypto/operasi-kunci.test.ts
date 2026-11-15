import { createPrivateKey } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bacaKeyring, tulisKeyring } from "./keyring";
import {
  KeadaanTidakPasti,
  OperasiKunciGagal,
  buatKunci,
  cabutKunciOperator,
  didalamRepository,
  putarKunciOperator,
  statusKeyringKePrisma,
  statusPrismaKeKeyring,
  type BarisKunci,
  type Konteks,
  type KlienKunci,
} from "./operasi-kunci";
import { idKunci } from "./tanda-tangan";

// DATA SINTETIS: kunci dibangkitkan saat uji, folder sementara, DB tiruan. Tidak ada jalur nyata.
const T0 = new Date("2026-01-01T00:00:00.000Z");
const T1 = new Date("2026-02-01T00:00:00.000Z");
const POSIX = process.platform !== "win32";

let folder: string;
let akarRepo: string;
let luar: string;
let berkasKeyring: string;
let out1: string;
let out2: string;

beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "kyrion-operasi-kunci-"));
  akarRepo = path.join(folder, "repo");
  luar = path.join(folder, "luar");
  await mkdir(akarRepo);
  await mkdir(luar);
  berkasKeyring = path.join(luar, "keyring.json");
  out1 = path.join(luar, "k1.pem");
  out2 = path.join(luar, "k2.pem");
});
afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});

interface OpsiDb {
  count?: number;
  updateCount?: number;
  gagalCommit?: boolean;
}

/** DB tiruan: mencatat urutan panggilan dan nasib transaksi. */
function dbTiruan(opsi: OpsiDb = {}) {
  const log: string[] = [];
  const dibuat: BarisKunci[] = [];
  const diubah: unknown[] = [];
  const nasib = { commit: false, rollback: false };
  const db: KlienKunci = {
    async $transaction(fn) {
      try {
        const hasil = await fn({
          signingKey: {
            count: async () => {
              log.push("count");
              return opsi.count ?? 0;
            },
            create: async ({ data }) => {
              log.push("create");
              dibuat.push(data);
            },
            updateMany: async (args) => {
              log.push("updateMany");
              diubah.push(args);
              return { count: opsi.updateCount ?? 1 };
            },
          },
        });
        if (opsi.gagalCommit) throw new Error("commit gagal");
        nasib.commit = true;
        return hasil;
      } catch (error) {
        nasib.rollback = true;
        throw error;
      }
    },
  };
  return { db, log, dibuat, diubah, nasib };
}

const konteks = (db: KlienKunci, jam: Date = T0, tambahan: Partial<Konteks> = {}): Konteks => ({
  db,
  berkasKeyring,
  akarRepo,
  jam: () => jam,
  ...tambahan,
});

const ada = (p: string) =>
  stat(p).then(
    () => true,
    () => false,
  );

describe("pemetaan status", () => {
  it("dua arah, nilai tak dikenal ditolak", () => {
    expect(statusKeyringKePrisma("aktif")).toBe("AKTIF");
    expect(statusKeyringKePrisma("dirotasi")).toBe("DIROTASI");
    expect(statusKeyringKePrisma("dicabut")).toBe("DICABUT");
    expect(statusPrismaKeKeyring("AKTIF")).toBe("aktif");
    expect(statusPrismaKeKeyring("DIROTASI")).toBe("dirotasi");
    expect(statusPrismaKeKeyring("DICABUT")).toBe("dicabut");
    expect(() => statusKeyringKePrisma("AKTIF")).toThrow(OperasiKunciGagal);
    expect(() => statusKeyringKePrisma("toString")).toThrow(OperasiKunciGagal);
    expect(() => statusPrismaKeKeyring("aktif")).toThrow(OperasiKunciGagal);
    expect(() => statusPrismaKeKeyring("")).toThrow(OperasiKunciGagal);
  });
});

describe("didalamRepository", () => {
  it("membedakan dalam, luar, dan folder bernama mirip", () => {
    const akar = path.resolve("/x/repo");
    expect(didalamRepository(path.resolve("/x/repo/a.pem"), akar)).toBe(true);
    expect(didalamRepository(path.resolve("/x/repo/..data/a.pem"), akar)).toBe(true);
    expect(didalamRepository(path.resolve("/x/repo-lain/a.pem"), akar)).toBe(false);
    expect(didalamRepository(path.resolve("/x/a.pem"), akar)).toBe(false);
  });
});

describe("buatKunci", () => {
  it("membuat berkas privat, entri keyring publik-saja, dan baris DB AKTIF", async () => {
    const t = dbTiruan();
    const hasil = await buatKunci(konteks(t.db), { out: out1 });

    const pem = await readFile(out1, "utf8");
    expect(createPrivateKey(pem).asymmetricKeyType).toBe("ed25519");
    if (POSIX) expect((await stat(out1)).mode & 0o777).toBe(0o600);

    const teksKeyring = await readFile(berkasKeyring, "utf8");
    expect(teksKeyring).not.toContain("PRIVATE KEY");
    const keyring = await bacaKeyring(berkasKeyring);
    expect(keyring.kunci).toHaveLength(1);
    expect(keyring.kunci[0]).toMatchObject({
      id: hasil.id,
      status: "aktif",
      dibuatPada: T0.toISOString(),
      dirotasiPada: null,
      dicabutPada: null,
    });

    expect(t.log).toEqual(["count", "create"]);
    expect(t.dibuat).toHaveLength(1);
    expect(t.dibuat[0]).toMatchObject({ id: hasil.id, status: "AKTIF", createdAt: T0 });
    expect(t.dibuat[0].publicKey.byteLength).toBe(44);
    expect(idKunci(t.dibuat[0].publicKey)).toBe(hasil.id);
    expect(t.nasib).toEqual({ commit: true, rollback: false });
    expect(hasil).toEqual({ id: hasil.id, out: out1, status: "aktif" });
    expect(JSON.stringify(hasil)).not.toContain("PRIVATE KEY");
  });

  it("kata kunci: id hasil buat == idKunci(kunci publik di berkas keyring)", async () => {
    const hasil = await buatKunci(konteks(dbTiruan().db), { out: out1 });
    const [entri] = (await bacaKeyring(berkasKeyring)).kunci;
    expect(idKunci(Buffer.from(entri.kunciPublik, "base64"))).toBe(hasil.id);
  });

  it("menolak berkas --out yang sudah ada tanpa menimpanya", async () => {
    await writeFile(out1, "ISI LAMA");
    const t = dbTiruan();
    await expect(buatKunci(konteks(t.db), { out: out1 })).rejects.toThrow(OperasiKunciGagal);
    expect(await readFile(out1, "utf8")).toBe("ISI LAMA");
    expect(t.log).toEqual([]);
    expect(await ada(berkasKeyring)).toBe(false);
  });

  it("menolak --out dan keyring di dalam repo, menerima folder bernama mirip di luar", async () => {
    await mkdir(path.join(akarRepo, "..data"));
    const t = dbTiruan();
    await expect(buatKunci(konteks(t.db), { out: path.join(akarRepo, "k.pem") })).rejects.toThrow(/dalam repository/);
    await expect(buatKunci(konteks(t.db), { out: path.join(akarRepo, "..data", "k.pem") })).rejects.toThrow(
      /dalam repository/,
    );
    await expect(
      buatKunci(konteks(t.db, T0, { berkasKeyring: path.join(akarRepo, "keyring.json") }), { out: out1 }),
    ).rejects.toThrow(/dalam repository/);
    expect(await ada(path.join(akarRepo, "k.pem"))).toBe(false);
    expect(await ada(out1)).toBe(false);

    const mirip = path.join(folder, "repo-lain");
    await mkdir(mirip);
    await expect(buatKunci(konteks(t.db), { out: path.join(mirip, "k.pem") })).resolves.toBeDefined();
  });

  it("menolak --out sama dengan berkas keyring", async () => {
    await expect(buatKunci(konteks(dbTiruan().db), { out: berkasKeyring })).rejects.toThrow(OperasiKunciGagal);
  });

  it("menolak bila keyring sudah punya kunci aktif; tidak ada berkas privat dibuat", async () => {
    await buatKunci(konteks(dbTiruan().db), { out: out1 });
    await expect(buatKunci(konteks(dbTiruan().db), { out: out2 })).rejects.toThrow(/sudah ada kunci aktif/);
    expect(await ada(out2)).toBe(false);
  });

  it("menolak keyring hilang tetapi tabel berisi; berkas privat dihapus, DB rollback", async () => {
    const t = dbTiruan({ count: 2 });
    await expect(buatKunci(konteks(t.db), { out: out1 })).rejects.toThrow(/tidak kosong/);
    expect(t.log).toEqual(["count"]);
    expect(t.nasib.rollback).toBe(true);
    expect(await ada(out1)).toBe(false);
    expect(await ada(berkasKeyring)).toBe(false);
  });

  it("keyring ada tetapi rusak ditolak (bukan dianggap kosong)", async () => {
    await writeFile(berkasKeyring, "bukan json");
    await expect(buatKunci(konteks(dbTiruan().db), { out: out1 })).rejects.toThrow();
    expect(await readFile(berkasKeyring, "utf8")).toBe("bukan json");
    expect(await ada(out1)).toBe(false);
  });
});

describe("putarKunciOperator", () => {
  it("lama ke DIROTASI dulu, baru baru AKTIF; keyring konsisten", async () => {
    const awal = await buatKunci(konteks(dbTiruan().db), { out: out1 });
    const t = dbTiruan();
    const hasil = await putarKunciOperator(konteks(t.db, T1), { out: out2 });

    expect(t.log).toEqual(["updateMany", "create"]);
    expect(t.diubah[0]).toEqual({
      where: { id: awal.id, status: "AKTIF" },
      data: { status: "DIROTASI", rotatedAt: T1 },
    });
    expect(t.dibuat[0]).toMatchObject({ id: hasil.id, status: "AKTIF", createdAt: T1 });

    const keyring = await bacaKeyring(berkasKeyring);
    const lama = keyring.kunci.find((e) => e.id === awal.id);
    const baru = keyring.kunci.find((e) => e.id === hasil.id);
    expect(lama).toMatchObject({ status: "dirotasi", dirotasiPada: T1.toISOString() });
    expect(baru).toMatchObject({ status: "aktif", dibuatPada: T1.toISOString() });
    expect(hasil).toMatchObject({ idLama: awal.id, out: out2, status: "aktif" });
    expect(createPrivateKey(await readFile(out2, "utf8")).asymmetricKeyType).toBe("ed25519");
  });

  it("menolak tanpa kunci aktif", async () => {
    const awal = await buatKunci(konteks(dbTiruan().db), { out: out1 });
    await cabutKunciOperator(konteks(dbTiruan().db, T1), { id: awal.id });
    await expect(putarKunciOperator(konteks(dbTiruan().db, T1), { out: out2 })).rejects.toThrow(/tidak ada kunci aktif/);
    expect(await ada(out2)).toBe(false);
  });

  it("menolak keyring belum ada", async () => {
    await expect(putarKunciOperator(konteks(dbTiruan().db), { out: out1 })).rejects.toThrow();
    expect(await ada(out1)).toBe(false);
  });

  it("DB tidak cocok (updateMany count 0): rollback, privat baru dihapus, keyring utuh", async () => {
    await buatKunci(konteks(dbTiruan().db), { out: out1 });
    const sebelum = await readFile(berkasKeyring, "utf8");
    const t = dbTiruan({ updateCount: 0 });
    await expect(putarKunciOperator(konteks(t.db, T1), { out: out2 })).rejects.toThrow(/tidak cocok/);
    expect(t.log).toEqual(["updateMany"]);
    expect(t.nasib.rollback).toBe(true);
    expect(await ada(out2)).toBe(false);
    expect(await readFile(berkasKeyring, "utf8")).toBe(sebelum);
  });
});

describe("cabutKunciOperator", () => {
  it("mencabut kunci AKTIF: status dan revoked_at benar, peringatan tak ada aktif", async () => {
    const awal = await buatKunci(konteks(dbTiruan().db), { out: out1 });
    const t = dbTiruan();
    const hasil = await cabutKunciOperator(konteks(t.db, T1), { id: awal.id });

    expect(t.diubah[0]).toEqual({
      where: { id: awal.id, status: { in: ["AKTIF", "DIROTASI"] } },
      data: { status: "DICABUT", revokedAt: T1 },
    });
    expect((await bacaKeyring(berkasKeyring)).kunci[0]).toMatchObject({
      status: "dicabut",
      dicabutPada: T1.toISOString(),
    });
    expect(hasil).toEqual({ id: awal.id, status: "dicabut", adaKunciAktifTersisa: false });
  });

  it("mencabut kunci DIROTASI: kunci aktif tetap ada", async () => {
    const lama = await buatKunci(konteks(dbTiruan().db), { out: out1 });
    await putarKunciOperator(konteks(dbTiruan().db, T1), { out: out2 });
    const hasil = await cabutKunciOperator(konteks(dbTiruan().db, T1), { id: lama.id });
    expect(hasil.adaKunciAktifTersisa).toBe(true);
  });

  it("menolak id tak dikenal, id berformat salah, dan kunci sudah dicabut", async () => {
    const awal = await buatKunci(konteks(dbTiruan().db), { out: out1 });
    const t = dbTiruan();
    await expect(cabutKunciOperator(konteks(t.db), { id: "0".repeat(32) })).rejects.toThrow(/tidak dikenal/);
    await expect(cabutKunciOperator(konteks(t.db), { id: "ABC" })).rejects.toThrow(OperasiKunciGagal);
    expect(t.log).toEqual([]);
    await cabutKunciOperator(konteks(dbTiruan().db, T1), { id: awal.id });
    await expect(cabutKunciOperator(konteks(dbTiruan().db, T1), { id: awal.id })).rejects.toThrow(/sudah dicabut/);
  });

  it("menolak keyring di dalam repo", async () => {
    await expect(
      cabutKunciOperator(konteks(dbTiruan().db, T0, { berkasKeyring: path.join(akarRepo, "keyring.json") }), {
        id: "0".repeat(32),
      }),
    ).rejects.toThrow(/dalam repository/);
  });
});

describe("kegagalan di tengah", () => {
  it("tulisKeyring gagal di dalam tx: DB rollback, privat baru dihapus, keyring lama utuh", async () => {
    await buatKunci(konteks(dbTiruan().db), { out: out1 });
    const sebelum = await readFile(berkasKeyring, "utf8");
    const t = dbTiruan();
    const gagalTulis: typeof tulisKeyring = async () => {
      throw new Error("disk penuh");
    };
    await expect(
      putarKunciOperator(konteks(t.db, T1, { tulisKeyring: gagalTulis }), { out: out2 }),
    ).rejects.toThrow("disk penuh");
    expect(t.log).toEqual(["updateMany", "create"]);
    expect(t.nasib).toEqual({ commit: false, rollback: true });
    expect(await ada(out2)).toBe(false);
    expect(await readFile(berkasKeyring, "utf8")).toBe(sebelum);
  });

  it("rm pembersihan gagal: galat asli tetap yang diteruskan", async () => {
    // Berkas privat diganti folder berisi: rm tanpa recursive pasti gagal.
    const gagalTulis: typeof tulisKeyring = async () => {
      await rm(out1);
      await mkdir(out1);
      await writeFile(path.join(out1, "isi"), "x");
      throw new Error("disk penuh");
    };
    await expect(buatKunci(konteks(dbTiruan().db, T0, { tulisKeyring: gagalTulis }), { out: out1 })).rejects.toThrow(
      "disk penuh",
    );
  });

  it("commit gagal setelah keyring ditulis: keyring tidak diubah, privat tidak dihapus, galat tidak pasti", async () => {
    const t = dbTiruan({ gagalCommit: true });
    const galat = await buatKunci(konteks(t.db), { out: out1 }).catch((e: unknown) => e);
    expect(galat).toBeInstanceOf(KeadaanTidakPasti);
    expect((galat as Error).message).toMatch(/keadaan tidak pasti/);
    expect((galat as Error).message).toMatch(/gagal tertutup/);
    // Keyring yang sudah ditulis dibiarkan apa adanya; berkas privat tetap ada.
    expect((await bacaKeyring(berkasKeyring)).kunci).toHaveLength(1);
    expect(await ada(out1)).toBe(true);
  });
});
