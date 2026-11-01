import { describe, expect, it } from "vitest";
import { LABEL_KANONIS, kanonisasiVersi, type DataVersiTerlindung } from "./kanonis";

// DATA SINTETIS: id, nomor versi, dan nama berkas fiktif. Nama berkas memuat "é"
// (U+00E9, bentuk NFC) agar jalur UTF-8 dan normalisasi ikut teruji.
const DATA: DataVersiTerlindung = {
  id: "0196b6a0-3c1e-7b2a-9f4d-5e8a1c2b3d4f",
  regulationId: "0196b6a0-1111-7000-8000-000000000001",
  versionNumber: "2025/2026",
  effectiveDate: "2025-08-01",
  fileSha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  fileName: "pedoman-akademik-é.pdf",
  fileSize: 123456,
};

// Byte kanonis yang diharapkan, dihitung oleh skrip Python stdlib terpisah (struct.pack(">I", len)
// + UTF-8 per field, label lebih dulu, fileSize sebagai teks desimal), bukan oleh kanonisasiVersi.
// Skrip yang sama menghitung tag di mac.test.ts.
const KANONIS_HEX =
  "000000116b7972696f6e3a76657273696f6e3a76310000002430313936623661302d336331652d376232612d39" +
  "6634642d3565386131633262336434660000002430313936623661302d313131312d373030302d383030302d30" +
  "303030303030303030303100000009323032352f323032360000000a323032352d30382d303100000040626137" +
  "38313662663866303163666561343134313430646535646165323232336230303336316133393631373761396362" +
  "343130666636316632303031356164000000177065646f6d616e2d616b6164656d696b2dc3a92e70646600000006" +
  "313233343536";

describe("kanonisasiVersi", () => {
  it("menghasilkan byte persis sesuai acuan eksternal", () => {
    expect(kanonisasiVersi(DATA).toString("hex")).toBe(KANONIS_HEX);
  });

  it("diawali label yang diberi awalan panjang 4 byte big-endian", () => {
    const hasil = kanonisasiVersi(DATA);
    expect(hasil.readUInt32BE(0)).toBe(LABEL_KANONIS.length);
    expect(hasil.subarray(4, 4 + LABEL_KANONIS.length).toString("utf8")).toBe(LABEL_KANONIS);
  });

  it("deterministik untuk data yang sama", () => {
    expect(kanonisasiVersi({ ...DATA }).equals(kanonisasiVersi(DATA))).toBe(true);
  });

  it("menyamakan 'é' tunggal (NFC) dengan 'e' + aksen terpisah (NFD)", () => {
    const nfd = { ...DATA, fileName: "pedoman-akademik-é.pdf" };
    expect(kanonisasiVersi(nfd).equals(kanonisasiVersi(DATA))).toBe(true);
  });

  it("membedakan data bila nilai dua field bertukar tempat (urutan field bagian dari format)", () => {
    const a = { ...DATA, versionNumber: "ab", fileName: "c" };
    const b = { ...DATA, versionNumber: "c", fileName: "ab" };
    expect(kanonisasiVersi(a).equals(kanonisasiVersi(b))).toBe(false);
  });

  it("membedakan data bila batas antarbagian bergeser (awalan panjang)", () => {
    const a = { ...DATA, versionNumber: "ab", fileName: "c.pdf" };
    const b = { ...DATA, versionNumber: "a", fileName: "bc.pdf" };
    expect(kanonisasiVersi(a).equals(kanonisasiVersi(b))).toBe(false);
  });

  it.each<[string, Partial<DataVersiTerlindung>]>([
    ["id bukan UUID", { id: "bukan-uuid" }],
    ["id UUID huruf besar", { id: DATA.id.toUpperCase() }],
    ["regulationId bukan UUID", { regulationId: "123" }],
    ["tanggal tidak mustahil tapi format salah (tanpa nol)", { effectiveDate: "2025-8-1" }],
    ["tanggal mustahil (30 Februari)", { effectiveDate: "2025-02-30" }],
    ["fileSha256 huruf besar", { fileSha256: DATA.fileSha256.toUpperCase() }],
    ["fileSha256 63 karakter", { fileSha256: DATA.fileSha256.slice(1) }],
    ["fileSha256 bukan hex", { fileSha256: "z".repeat(64) }],
    ["fileSize negatif", { fileSize: -1 }],
    ["fileSize pecahan", { fileSize: 1.5 }],
    ["fileSize NaN", { fileSize: Number.NaN }],
    ["versionNumber dengan surrogate yatim", { versionNumber: "2025\ud800" }],
    ["fileName dengan surrogate yatim", { fileName: "a\udc00.pdf" }],
  ])("menolak %s dengan RangeError", (_nama, ubah) => {
    expect(() => kanonisasiVersi({ ...DATA, ...ubah })).toThrow(RangeError);
  });

  it("pesan galat hanya menyebut nama field, bukan nilainya", () => {
    expect(() => kanonisasiVersi({ ...DATA, fileSha256: "RAHASIA" })).toThrow(
      "Field tidak sah: fileSha256",
    );
  });
});
