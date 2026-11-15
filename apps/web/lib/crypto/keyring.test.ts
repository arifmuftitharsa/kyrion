import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  KeyringTidakValid,
  bacaKeyring,
  cabutKunci,
  cariKunci,
  kunciBolehMemverifikasi,
  parseKeyring,
  putarKunci,
  tambahKunciAktif,
  tulisKeyring,
  type EntriKunci,
  type Keyring,
} from "./keyring";
import { bangkitkanPasanganKunci, idKunci } from "./tanda-tangan";

// DATA SINTETIS: kunci dibangkitkan saat uji, bukan kunci sungguhan.
const T0 = new Date("2026-01-01T00:00:00.000Z");
const T1 = new Date("2026-02-01T00:00:00.000Z");
const T2 = new Date("2026-03-01T00:00:00.000Z");
const KOSONG: Keyring = { versi: 1, kunci: [] };

function entriMentah(der: Buffer, ubah: Record<string, unknown> = {}) {
  return {
    id: idKunci(der),
    kunciPublik: der.toString("base64"),
    status: "aktif",
    dibuatPada: T0.toISOString(),
    dirotasiPada: null,
    dicabutPada: null,
    ...ubah,
  };
}

const teks = (kunci: unknown[], tambahan: Record<string, unknown> = {}) =>
  JSON.stringify({ versi: 1, kunci, ...tambahan });

const baru = () => bangkitkanPasanganKunci().kunciPublikDer;

describe("parseKeyring", () => {
  it("menerima keyring valid", () => {
    const a = baru();
    const b = baru();
    const k = parseKeyring(
      teks([
        entriMentah(a, { status: "dirotasi", dirotasiPada: T1.toISOString() }),
        entriMentah(b, { dibuatPada: T1.toISOString() }),
      ]),
    );
    expect(k.kunci).toHaveLength(2);
    expect(parseKeyring(teks([]))).toEqual(KOSONG);
  });

  it.each([
    ["id tidak cocok dengan kunci", (a: Buffer) => teks([entriMentah(a, { id: "0".repeat(32) })])],
    ["dua aktif", (a: Buffer) => teks([entriMentah(a), entriMentah(baru())])],
    ["id ganda", (a: Buffer) => teks([entriMentah(a, { status: "dicabut", dicabutPada: T1.toISOString() }), entriMentah(a, { status: "dicabut", dicabutPada: T1.toISOString() })])],
    ["status tidak dikenal", (a: Buffer) => teks([entriMentah(a, { status: "kedaluwarsa" })])],
    ["aktif dengan dirotasiPada", (a: Buffer) => teks([entriMentah(a, { dirotasiPada: T1.toISOString() })])],
    ["aktif dengan dicabutPada", (a: Buffer) => teks([entriMentah(a, { dicabutPada: T1.toISOString() })])],
    ["dirotasi tanpa dirotasiPada", (a: Buffer) => teks([entriMentah(a, { status: "dirotasi" })])],
    ["dicabut tanpa dicabutPada", (a: Buffer) => teks([entriMentah(a, { status: "dicabut" })])],
    ["field tak dikenal di entri", (a: Buffer) => teks([entriMentah(a, { rahasia: 1 })])],
    ["field tak dikenal di akar", (a: Buffer) => teks([entriMentah(a)], { ekstra: true })],
    ["versi salah", (a: Buffer) => teks([entriMentah(a)], { versi: 2 })],
  ])("menolak: %s", (_nama, bangun) => {
    expect(() => parseKeyring(bangun(baru()))).toThrow(KeyringTidakValid);
  });

  it("menolak kunci publik yang bukan SPKI Ed25519 (RSA, sampah, base64 longgar)", async () => {
    const { generateKeyPairSync } = await import("node:crypto");
    const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey.export({ type: "spki", format: "der" });
    expect(() => parseKeyring(teks([entriMentah(rsa)]))).toThrow(KeyringTidakValid);
    const sampah = Buffer.from("bukan kunci");
    expect(() => parseKeyring(teks([entriMentah(sampah)]))).toThrow(KeyringTidakValid);
    const a = baru();
    expect(() => parseKeyring(teks([entriMentah(a, { kunciPublik: `${a.toString("base64")}!!` })]))).toThrow(KeyringTidakValid);
  });

  it("menolak JSON rusak tanpa membocorkan isinya", () => {
    expect(() => parseKeyring("{RAHASIA")).toThrow(KeyringTidakValid);
    expect(() => parseKeyring("{RAHASIA")).toThrow(expect.objectContaining({ message: expect.not.stringContaining("RAHASIA") }));
  });
});

describe("siklus kunci", () => {
  it("tambah, putar, lalu cabut dari aktif dan dari dirotasi", () => {
    const a = baru();
    const b = baru();
    const k1 = tambahKunciAktif(KOSONG, a, T0);
    expect(k1.kunci[0]).toMatchObject({ status: "aktif", dibuatPada: T0.toISOString() });

    const k2 = putarKunci(k1, b, T1);
    expect(cariKunci(k2, idKunci(a))).toMatchObject({ status: "dirotasi", dirotasiPada: T1.toISOString() });
    expect(cariKunci(k2, idKunci(b))).toMatchObject({ status: "aktif", dibuatPada: T1.toISOString() });

    const k3 = cabutKunci(k2, idKunci(b), T2);
    expect(cariKunci(k3, idKunci(b))).toMatchObject({ status: "dicabut", dicabutPada: T2.toISOString() });
    const k4 = cabutKunci(k2, idKunci(a), T2);
    expect(cariKunci(k4, idKunci(a))).toMatchObject({ status: "dicabut", dirotasiPada: T1.toISOString(), dicabutPada: T2.toISOString() });
  });

  it("menolak: cabut dua kali, cabut id tak dikenal, putar tanpa aktif, tambah saat sudah ada aktif", () => {
    const a = baru();
    const k1 = tambahKunciAktif(KOSONG, a, T0);
    const dicabut = cabutKunci(k1, idKunci(a), T1);
    expect(() => cabutKunci(dicabut, idKunci(a), T2)).toThrow(KeyringTidakValid);
    expect(() => cabutKunci(k1, "f".repeat(32), T1)).toThrow(KeyringTidakValid);
    expect(() => putarKunci(KOSONG, baru(), T1)).toThrow(KeyringTidakValid);
    expect(() => putarKunci(dicabut, baru(), T2)).toThrow(KeyringTidakValid);
    expect(() => tambahKunciAktif(k1, baru(), T1)).toThrow(KeyringTidakValid);
  });

  it("menolak kunci yang sudah ada dan kunci bukan Ed25519", () => {
    const a = baru();
    const dicabut = cabutKunci(tambahKunciAktif(KOSONG, a, T0), idKunci(a), T1);
    expect(() => tambahKunciAktif(dicabut, a, T2)).toThrow(KeyringTidakValid);
    expect(() => tambahKunciAktif(KOSONG, Buffer.from("sampah"), T0)).toThrow(KeyringTidakValid);
  });

  it("tidak mengubah masukan", () => {
    const a = baru();
    const k1 = tambahKunciAktif(KOSONG, a, T0);
    const salinan = structuredClone(k1);
    putarKunci(k1, baru(), T1);
    cabutKunci(k1, idKunci(a), T1);
    expect(k1).toEqual(salinan);
    expect(KOSONG).toEqual({ versi: 1, kunci: [] });
  });
});

describe("kunciBolehMemverifikasi", () => {
  const dasar: EntriKunci = {
    id: "0".repeat(32),
    kunciPublik: "x",
    status: "aktif",
    dibuatPada: T0.toISOString(),
    dirotasiPada: null,
    dicabutPada: null,
  };
  const dirotasi: EntriKunci = { ...dasar, status: "dirotasi", dirotasiPada: T1.toISOString() };
  const geser = (d: Date, ms: number) => new Date(d.getTime() + ms);

  it("dirotasi: tepat di dirotasiPada boleh, 1 ms sesudahnya tidak", () => {
    expect(kunciBolehMemverifikasi(dirotasi, T1)).toEqual({ boleh: true });
    expect(kunciBolehMemverifikasi(dirotasi, geser(T1, 1))).toEqual({
      boleh: false,
      alasan: "dirotasi-sebelum-penandatanganan",
    });
  });

  it("dicabut selalu ditolak", () => {
    const dicabut: EntriKunci = { ...dasar, status: "dicabut", dicabutPada: T2.toISOString() };
    expect(kunciBolehMemverifikasi(dicabut, T1)).toEqual({ boleh: false, alasan: "dicabut" });
    expect(kunciBolehMemverifikasi(dicabut, geser(T2, 1))).toEqual({ boleh: false, alasan: "dicabut" });
  });

  it("1 ms sebelum dibuatPada ditolak (aktif dan dirotasi); tepat di dibuatPada boleh", () => {
    const sebelum = geser(T0, -1);
    expect(kunciBolehMemverifikasi(dasar, sebelum)).toEqual({ boleh: false, alasan: "sebelum-dibuat" });
    expect(kunciBolehMemverifikasi(dirotasi, sebelum)).toEqual({ boleh: false, alasan: "sebelum-dibuat" });
    expect(kunciBolehMemverifikasi(dasar, T0)).toEqual({ boleh: true });
  });
});

describe("berkas keyring", () => {
  let folder: string;
  let lokasi: string;

  beforeEach(async () => {
    folder = await mkdtemp(path.join(tmpdir(), "kyrion-keyring-"));
    lokasi = path.join(folder, "keyring.json");
  });
  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  it("berkas tidak ada adalah galat, bukan keyring kosong", async () => {
    await expect(bacaKeyring(lokasi)).rejects.toThrow(KeyringTidakValid);
  });

  it("berkas rusak adalah galat", async () => {
    await writeFile(lokasi, "{rusak");
    await expect(bacaKeyring(lokasi)).rejects.toThrow(KeyringTidakValid);
  });

  it("tulis lalu baca kembali sama, dan tidak meninggalkan berkas sementara", async () => {
    const k = putarKunci(tambahKunciAktif(KOSONG, baru(), T0), baru(), T1);
    await tulisKeyring(lokasi, k);
    await tulisKeyring(lokasi, k); // menimpa berkas yang ada
    expect(await bacaKeyring(lokasi)).toEqual(k);
    expect(await readdir(folder)).toEqual(["keyring.json"]);
  });

  it("menolak menulis keyring tidak valid dan tidak mengubah berkas lama", async () => {
    const k = tambahKunciAktif(KOSONG, baru(), T0);
    await tulisKeyring(lokasi, k);
    const sebelum = await readFile(lokasi, "utf8");
    const rusak = { ...k, kunci: [{ ...k.kunci[0]!, id: "0".repeat(32) }] };
    await expect(tulisKeyring(lokasi, rusak)).rejects.toThrow(KeyringTidakValid);
    expect(await readFile(lokasi, "utf8")).toBe(sebelum);
    expect(await readdir(folder)).toEqual(["keyring.json"]);
  });
});
