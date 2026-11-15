import { generateKeyPairSync } from "node:crypto";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cabutKunci, putarKunci, tambahKunciAktif, tulisKeyring, type Keyring } from "./keyring";
import { PenandatanganTidakValid, muatKunciPrivat, siapkanPenandatangan } from "./penandatangan";
import { bangkitkanPasanganKunci, idKunci, tandatangani, verifikasiTandaTangan } from "./tanda-tangan";

// DATA SINTETIS: kunci dibangkitkan saat uji, bukan kunci sungguhan.
const T0 = new Date("2026-01-01T00:00:00.000Z");
const T1 = new Date("2026-02-01T00:00:00.000Z");
const KOSONG: Keyring = { versi: 1, kunci: [] };
const POSIX = process.platform !== "win32";

let folder: string;
let berkasPrivat: string;
let berkasKeyring: string;

beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "kyrion-penandatangan-"));
  berkasPrivat = path.join(folder, "kunci.pem");
  berkasKeyring = path.join(folder, "keyring.json");
});
afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});

const simpanPem = (pem: string) => writeFile(berkasPrivat, pem, { mode: 0o600 });

describe("muatKunciPrivat", () => {
  it("menolak lokasi belum diatur dan berkas tidak ada", async () => {
    await expect(muatKunciPrivat(undefined)).rejects.toThrow(PenandatanganTidakValid);
    await expect(muatKunciPrivat(berkasPrivat)).rejects.toThrow(PenandatanganTidakValid);
  });

  it("memuat PEM Ed25519 yang bisa menandatangani", async () => {
    const p = bangkitkanPasanganKunci();
    await simpanPem(p.kunciPrivatPem);
    const kunci = await muatKunciPrivat(berkasPrivat);
    const pesan = Buffer.from("uji");
    expect(verifikasiTandaTangan(pesan, tandatangani(pesan, kunci), p.kunciPublikDer)).toBe(true);
  });

  it("menolak PEM RSA", async () => {
    const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" });
    await simpanPem(rsa.toString());
    await expect(muatKunciPrivat(berkasPrivat)).rejects.toThrow(PenandatanganTidakValid);
  });

  it("PEM rusak ditolak dan pesan galat tidak memuat PEM", async () => {
    await simpanPem("-----BEGIN PRIVATE KEY-----\nRAHASIAPEM\n-----END PRIVATE KEY-----\n");
    const galat = await muatKunciPrivat(berkasPrivat).catch((e: unknown) => e);
    expect(galat).toBeInstanceOf(PenandatanganTidakValid);
    expect((galat as Error).message).not.toMatch(/RAHASIAPEM|BEGIN/);
  });

  // Hanya bermakna di POSIX; di Windows pemeriksaan izin sengaja dilewati.
  it.skipIf(!POSIX)("menolak berkas yang bisa dibaca grup atau pengguna lain", async () => {
    await simpanPem(bangkitkanPasanganKunci().kunciPrivatPem);
    await chmod(berkasPrivat, 0o640);
    await expect(muatKunciPrivat(berkasPrivat)).rejects.toThrow(PenandatanganTidakValid);
  });
});

describe("siapkanPenandatangan", () => {
  it("lolos bila kunci privat cocok dengan entri aktif", async () => {
    const p = bangkitkanPasanganKunci();
    await simpanPem(p.kunciPrivatPem);
    await tulisKeyring(berkasKeyring, tambahKunciAktif(KOSONG, p.kunciPublikDer, T0));
    const hasil = await siapkanPenandatangan({ berkasKunciPrivat: berkasPrivat, berkasKeyring });
    expect(hasil.idKunci).toBe(idKunci(p.kunciPublikDer));
    const pesan = Buffer.from("uji");
    expect(verifikasiTandaTangan(pesan, tandatangani(pesan, hasil.kunciPrivat), p.kunciPublikDer)).toBe(true);
  });

  it("galat bila kunci tidak ada di keyring", async () => {
    await simpanPem(bangkitkanPasanganKunci().kunciPrivatPem);
    await tulisKeyring(berkasKeyring, tambahKunciAktif(KOSONG, bangkitkanPasanganKunci().kunciPublikDer, T0));
    await expect(siapkanPenandatangan({ berkasKunciPrivat: berkasPrivat, berkasKeyring })).rejects.toThrow(PenandatanganTidakValid);
  });

  it("galat bila kunci ada tetapi dirotasi atau dicabut", async () => {
    const p = bangkitkanPasanganKunci();
    await simpanPem(p.kunciPrivatPem);
    const aktif = tambahKunciAktif(KOSONG, p.kunciPublikDer, T0);
    const dirotasi = putarKunci(aktif, bangkitkanPasanganKunci().kunciPublikDer, T1);
    await tulisKeyring(berkasKeyring, dirotasi);
    await expect(siapkanPenandatangan({ berkasKunciPrivat: berkasPrivat, berkasKeyring })).rejects.toThrow(/dirotasi/);
    await tulisKeyring(berkasKeyring, cabutKunci(aktif, idKunci(p.kunciPublikDer), T1));
    await expect(siapkanPenandatangan({ berkasKunciPrivat: berkasPrivat, berkasKeyring })).rejects.toThrow(/dicabut/);
  });

  it("galat bila keyring tidak ada atau lokasinya belum diatur", async () => {
    await simpanPem(bangkitkanPasanganKunci().kunciPrivatPem);
    await expect(siapkanPenandatangan({ berkasKunciPrivat: berkasPrivat, berkasKeyring })).rejects.toThrow();
    await expect(siapkanPenandatangan({ berkasKunciPrivat: berkasPrivat, berkasKeyring: undefined })).rejects.toThrow(PenandatanganTidakValid);
  });

  it("PEM bukan Ed25519 atau rusak = galat", async () => {
    await tulisKeyring(berkasKeyring, tambahKunciAktif(KOSONG, bangkitkanPasanganKunci().kunciPublikDer, T0));
    const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" });
    await simpanPem(rsa.toString());
    await expect(siapkanPenandatangan({ berkasKunciPrivat: berkasPrivat, berkasKeyring })).rejects.toThrow(PenandatanganTidakValid);
    await simpanPem("-----BEGIN PRIVATE KEY-----\nRAHASIAPEM\n-----END PRIVATE KEY-----\n");
    const galat = await siapkanPenandatangan({ berkasKunciPrivat: berkasPrivat, berkasKeyring }).catch((e: unknown) => e);
    expect(galat).toBeInstanceOf(PenandatanganTidakValid);
    expect((galat as Error).message).not.toMatch(/RAHASIAPEM|BEGIN/);
  });
});
