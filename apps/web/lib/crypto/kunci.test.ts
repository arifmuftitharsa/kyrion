import { chmod, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { KunciTidakValid, bacaKunciInduk, buatBerkasKunci, parseKunciInduk } from "./kunci";

// DATA SINTETIS: kunci hex uji, bukan kunci sungguhan.
const HEX = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const BYTES = Buffer.from(HEX, "hex");
const POSIX = process.platform !== "win32";

let folder: string;
let lokasi: string;

beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "kyrion-kunci-"));
  lokasi = path.join(folder, "kunci.hex");
});

afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});

describe("parseKunciInduk", () => {
  it("mengurai 64 karakter hex menjadi 32 byte", () => {
    expect(parseKunciInduk(HEX).equals(BYTES)).toBe(true);
  });

  it("memangkas spasi dan newline di ujung", () => {
    expect(parseKunciInduk(`  ${HEX}\r\n`).equals(BYTES)).toBe(true);
  });

  it.each([
    ["kosong", ""],
    ["hanya spasi", "   \n"],
    ["terlalu pendek (62 karakter)", HEX.slice(2)],
    ["terlalu panjang (66 karakter)", `${HEX}00`],
    ["bukan hex", "zz".repeat(32)],
    ["berawalan 0x", `0x${HEX.slice(2)}`],
    ["spasi di tengah", `${HEX.slice(0, 10)} ${HEX.slice(11)}`],
    ["dua baris", `${HEX.slice(0, 32)}\n${HEX.slice(32)}`],
  ])("menolak teks %s dengan KunciTidakValid", (_nama, teks) => {
    expect(() => parseKunciInduk(teks)).toThrow(KunciTidakValid);
  });

  it("pesan galat tidak memuat isi teks", () => {
    expect(() => parseKunciInduk("RAHASIA-BUKAN-HEX")).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining("RAHASIA") }),
    );
  });
});

describe("bacaKunciInduk", () => {
  it("menolak lokasi yang belum diatur", async () => {
    await expect(bacaKunciInduk(undefined)).rejects.toThrow(KunciTidakValid);
    await expect(bacaKunciInduk("")).rejects.toThrow(KunciTidakValid);
  });

  it("menolak berkas yang tidak ada", async () => {
    await expect(bacaKunciInduk(lokasi)).rejects.toThrow(KunciTidakValid);
  });

  it("menolak berkas berisi kunci pendek atau bukan hex", async () => {
    await writeFile(lokasi, "abcd\n", { mode: 0o600 });
    await expect(bacaKunciInduk(lokasi)).rejects.toThrow(KunciTidakValid);
    await writeFile(lokasi, `${"zz".repeat(32)}\n`, { mode: 0o600 });
    await expect(bacaKunciInduk(lokasi)).rejects.toThrow(KunciTidakValid);
  });

  it("membaca berkas berisi hex yang sah", async () => {
    await writeFile(lokasi, `${HEX}\n`, { mode: 0o600 });
    expect((await bacaKunciInduk(lokasi)).equals(BYTES)).toBe(true);
  });

  // Hanya bermakna di POSIX; di Windows pemeriksaan izin sengaja dilewati.
  it.skipIf(!POSIX)("menolak berkas yang bisa dibaca grup atau pengguna lain", async () => {
    await writeFile(lokasi, `${HEX}\n`, { mode: 0o600 });
    await chmod(lokasi, 0o640);
    await expect(bacaKunciInduk(lokasi)).rejects.toThrow(KunciTidakValid);
    await chmod(lokasi, 0o604);
    await expect(bacaKunciInduk(lokasi)).rejects.toThrow(KunciTidakValid);
  });
});

describe("buatBerkasKunci", () => {
  it("membuat berkas berisi kunci 32 byte yang bisa dibaca kembali", async () => {
    await buatBerkasKunci(lokasi);
    expect(await bacaKunciInduk(lokasi)).toHaveLength(32);
  });

  it("menghasilkan kunci berbeda tiap kali dibuat", async () => {
    const lain = path.join(folder, "lain.hex");
    await buatBerkasKunci(lokasi);
    await buatBerkasKunci(lain);
    expect((await bacaKunciInduk(lokasi)).equals(await bacaKunciInduk(lain))).toBe(false);
  });

  it("menolak menimpa berkas yang sudah ada dan tidak mengubah isinya", async () => {
    await buatBerkasKunci(lokasi);
    const sebelum = await readFile(lokasi, "utf8");
    await expect(buatBerkasKunci(lokasi)).rejects.toThrow(/EEXIST/);
    expect(await readFile(lokasi, "utf8")).toBe(sebelum);
  });

  it.skipIf(!POSIX)("membuat berkas dengan mode 0o600", async () => {
    await buatBerkasKunci(lokasi);
    expect((await stat(lokasi)).mode & 0o777).toBe(0o600);
  });
});
