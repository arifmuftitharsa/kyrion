import { describe, expect, it } from "vitest";
import { perubahanAntaraVersi, type VersiBanding } from "./banding";

const ubah = (id: string) => ({ id, description: `Perubahan ${id}`, source: "CHANGELOG" as const, page: null });

function versi(id: string, effectiveDate: string, status: VersiBanding["status"], perubahan: string[] = []): VersiBanding {
  return { id, versionNumber: id, effectiveDate, status, perubahan: perubahan.map(ubah) };
}

const A = versi("A", "2024-08-01", "DIGANTIKAN");
const B = versi("B", "2025-08-01", "DIGANTIKAN", ["b1", "b2"]);
const C = versi("C", "2026-08-01", "SAH", ["c1"]);
const semua = [C, A, B]; // sengaja tidak berurutan

const idKelompok = (h: ReturnType<typeof perubahanAntaraVersi>) =>
  h.ok ? h.kelompok.map((k) => k.versi.id) : h;

describe("perubahanAntaraVersi", () => {
  it("menolak versi yang sama, juga bila id tidak ada", () => {
    expect(perubahanAntaraVersi(semua, "A", "A")).toEqual({ ok: false, galat: "VERSI_SAMA" });
    expect(perubahanAntaraVersi(semua, "X", "X")).toEqual({ ok: false, galat: "VERSI_SAMA" });
  });

  it("dua versi berurutan: hanya perubahan versi baru", () => {
    const hasil = perubahanAntaraVersi(semua, "A", "B");
    expect(hasil).toMatchObject({ ok: true, ditukar: false });
    expect(idKelompok(hasil)).toEqual(["B"]);
    expect(hasil.ok && hasil.kelompok[0].perubahan.map((p) => p.id)).toEqual(["b1", "b2"]);
  });

  it("dua versi berjarak: perubahan versi tengah ikut, versi lama tidak", () => {
    expect(idKelompok(perubahanAntaraVersi(semua, "A", "C"))).toEqual(["B", "C"]);
  });

  it("urutan terbalik ditukar otomatis dan hasilnya sama", () => {
    const maju = perubahanAntaraVersi(semua, "A", "C");
    const mundur = perubahanAntaraVersi(semua, "C", "A");
    expect(mundur).toMatchObject({ ok: true, ditukar: true });
    expect(mundur.ok && maju.ok && mundur.kelompok).toEqual(maju.ok && maju.kelompok);
    expect(mundur.ok && [mundur.dari.id, mundur.ke.id]).toEqual(["A", "C"]);
  });

  it.each(["DRAF", "DIBATALKAN"] as const)("versi berstatus %s tidak ditemukan", (status) => {
    const x = versi("X", "2027-01-01", status, ["x1"]);
    const daftar = [...semua, x];
    expect(perubahanAntaraVersi(daftar, "A", "X")).toEqual({ ok: false, galat: "TIDAK_DITEMUKAN" });
    expect(perubahanAntaraVersi(daftar, "X", "A")).toEqual({ ok: false, galat: "TIDAK_DITEMUKAN" });
  });

  it("id tidak ada tidak ditemukan", () => {
    expect(perubahanAntaraVersi(semua, "A", "tidak-ada")).toEqual({ ok: false, galat: "TIDAK_DITEMUKAN" });
  });

  it("versi Draf di tengah rentang tidak ikut", () => {
    const draf = versi("D", "2025-12-01", "DRAF", ["d1"]);
    expect(idKelompok(perubahanAntaraVersi([...semua, draf], "A", "C"))).toEqual(["B", "C"]);
  });

  it("versi tanpa Change tetap muncul sebagai kelompok kosong", () => {
    const hasil = perubahanAntaraVersi(semua, "B", "A");
    expect(hasil.ok && hasil.kelompok).toEqual([{ versi: B, perubahan: B.perubahan }]);
    const kosong = perubahanAntaraVersi([A, versi("K", "2025-01-01", "SAH")], "A", "K");
    expect(kosong.ok && kosong.kelompok[0].perubahan).toEqual([]);
  });

  it("tanggal sama: posisi mengikuti urutan masukan, tanpa galat", () => {
    const p = versi("P", "2025-01-01", "SAH");
    const q = versi("Q", "2025-01-01", "SAH");
    expect(idKelompok(perubahanAntaraVersi([p, q], "P", "Q"))).toEqual(["Q"]);
  });
});
