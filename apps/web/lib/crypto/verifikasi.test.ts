import { describe, expect, it } from "vitest";
import { MAX_INPUT_BYTES, fingerprint } from "./fingerprint";
import type { DataVersiTerlindung } from "./kanonis";
import { buatTagVersi } from "./mac";
import { IntegritasGagal, periksaIntegritasVersi } from "./verifikasi";

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

// DATA SINTETIS: kunci, PDF, dan metadata fiktif.
const KUNCI = Uint8Array.from({ length: 32 }, (_, i) => i);
const KUNCI_LAIN = Uint8Array.from({ length: 32 }, (_, i) => i + 32);
const PDF = encode("%PDF-1.7 DATA SINTETIS: isi berkas asli");
const PDF_PALSU = encode("%PDF-1.7 DATA SINTETIS: isi berkas pengganti");
const ID_LAIN = "0196b6a0-9999-7b2a-9f4d-5e8a1c2b3d4f";

const DATA: DataVersiTerlindung = {
  id: "0196b6a0-3c1e-7b2a-9f4d-5e8a1c2b3d4f",
  regulationId: "0196b6a0-1111-7000-8000-000000000001",
  versionNumber: "2025/2026",
  effectiveDate: "2025-08-01",
  fileSha256: fingerprint(PDF),
  fileName: "pedoman-akademik.pdf",
  fileSize: PDF.length,
};
const TAG = buatTagVersi(KUNCI, DATA);

function periksa(ubah: { data?: DataVersiTerlindung; tag?: string | null; bytes?: Uint8Array; kunci?: Uint8Array } = {}) {
  periksaIntegritasVersi({
    kunciInduk: ubah.kunci ?? KUNCI,
    data: ubah.data ?? DATA,
    tag: ubah.tag === undefined ? TAG : ubah.tag,
    bytes: ubah.bytes ?? PDF,
  });
}

describe("periksaIntegritasVersi", () => {
  it("meloloskan data, berkas, dan tag asli", () => {
    expect(() => periksa()).not.toThrow();
  });

  it.each<[string, Partial<DataVersiTerlindung>]>([
    ["id", { id: ID_LAIN }],
    ["regulationId", { regulationId: ID_LAIN }],
    ["versionNumber", { versionNumber: "2025/2027" }],
    ["effectiveDate", { effectiveDate: "2025-08-02" }],
    ["fileSha256", { fileSha256: fingerprint(PDF_PALSU) }],
    ["fileName", { fileName: "pedoman-lain.pdf" }],
    ["fileSize", { fileSize: PDF.length + 1 }],
  ])("menolak bila field %s diubah", (_nama, ubah) => {
    expect(() => periksa({ data: { ...DATA, ...ubah } })).toThrow(IntegritasGagal);
  });

  it("menolak bila satu bit tag diubah", () => {
    const terakhir = TAG.length - 1;
    const beda = (Number.parseInt(TAG[terakhir], 16) ^ 1).toString(16);
    const rusak = TAG.slice(0, terakhir) + beda;
    expect(rusak).not.toBe(TAG);
    expect(() => periksa({ tag: rusak })).toThrow(IntegritasGagal);
  });

  it("menolak bila kunci valid tetapi berbeda", () => {
    expect(() => periksa({ kunci: KUNCI_LAIN })).toThrow(IntegritasGagal);
  });

  // Penyerang menyalin isi dan tag sebuah baris ke baris lain (id lain). Tag mengikat id,
  // jadi salinan tidak lolos walau isi berkas, hash, dan tag semuanya asli.
  it("menolak tag dan data asli yang disalin ke baris dengan id lain", () => {
    expect(() => periksa({ data: { ...DATA, id: ID_LAIN } })).toThrow(IntegritasGagal);
  });

  it.each<[string, string | null]>([
    ["null", null],
    ["kosong", ""],
    ["tanpa awalan", TAG.slice(3)],
    ["awalan versi lain", `v2$${TAG.slice(3)}`],
    ["hex huruf besar", TAG.toUpperCase().replace("V1$", "v1$")],
    ["terlalu pendek", TAG.slice(0, -2)],
    ["terlalu panjang", `${TAG}00`],
    ["bukan hex", `v1$${"z".repeat(64)}`],
    ["spasi di ujung", `${TAG} `],
    ["teks acak", "bukan tag"],
  ])("menolak tag %s dengan IntegritasGagal, tanpa crash", (_nama, tag) => {
    expect(() => periksa({ tag })).toThrow(IntegritasGagal);
  });

  it("membungkus galat internal: kunci induk salah panjang", () => {
    expect(() => periksa({ kunci: new Uint8Array(31) })).toThrow(IntegritasGagal);
  });

  it("membungkus galat internal: field tidak sah (RangeError dari kanonisasi)", () => {
    const rusak = { ...DATA, fileSha256: DATA.fileSha256.toUpperCase() };
    expect(() => periksa({ data: rusak })).toThrow(IntegritasGagal);
  });

  it("membungkus galat internal: berkas melebihi batas (InputTooLargeError)", () => {
    const besar = new Uint8Array(MAX_INPUT_BYTES + 1);
    expect(() => periksa({ bytes: besar })).toThrow(IntegritasGagal);
  });

  it("pesan galat tetap dan tidak memuat tag, kunci, atau data", () => {
    let galat: unknown;
    try {
      periksa({ data: { ...DATA, versionNumber: "RAHASIA-2025" } });
    } catch (e) {
      galat = e;
    }
    expect(galat).toBeInstanceOf(IntegritasGagal);
    const { message } = galat as Error;
    expect(message).toBe("Integritas versi gagal diverifikasi.");
    expect(message).not.toContain(TAG);
    expect(message).not.toContain("RAHASIA");
  });

  // Sambungan ke F-30: HANYA byte PDF yang diganti. fileSha256 dan tag tetap asli, jadi
  // tag masih cocok dengan data (diperiksa di bawah) dan langkah HMAC akan meloloskan.
  // Satu-satunya yang menolak adalah verifyFingerprint. Uji ini GAGAL (tidak melempar)
  // bila panggilan verifyFingerprint di verifikasi.ts dihapus.
  it("menolak bila hanya byte PDF yang diganti (langkah verifyFingerprint)", () => {
    expect(buatTagVersi(KUNCI, DATA)).toBe(TAG);
    expect(() => periksa({ bytes: PDF_PALSU })).toThrow(IntegritasGagal);
  });

  // Skenario penyerang yang bisa menulis DB dan storage/: PDF diganti dan file_sha256
  // ditimpa dengan hash PDF baru. Hash polos F-30 saja lolos; tag lama sudah tidak cocok.
  it("menolak bila PDF dan fileSha256 diganti bersamaan dengan tag lama", () => {
    const dataPalsu = { ...DATA, fileSha256: fingerprint(PDF_PALSU) };
    expect(() => periksa({ data: dataPalsu, bytes: PDF_PALSU })).toThrow(IntegritasGagal);
  });
});
