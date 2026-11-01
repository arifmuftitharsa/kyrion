import { describe, expect, it } from "vitest";
import type { DataVersiTerlindung } from "./kanonis";
import { POLA_TAG, buatTagVersi, hmacSha256, turunkanKunciMac } from "./mac";

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

// Kunci induk uji: byte 0..31. DATA SINTETIS, bukan kunci sungguhan.
const KUNCI_INDUK = Uint8Array.from({ length: 32 }, (_, i) => i);

describe("hmacSha256", () => {
  // Vektor uji RFC 4231 bagian 4.2 (Test Case 1), diambil dari rfc-editor.org.
  it("sesuai RFC 4231 Test Case 1", () => {
    const key = new Uint8Array(20).fill(0x0b);
    expect(hmacSha256(key, encode("Hi There")).toString("hex")).toBe(
      "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7",
    );
  });

  // Vektor uji RFC 4231 bagian 4.3 (Test Case 2): kunci lebih pendek dari blok hash.
  it("sesuai RFC 4231 Test Case 2", () => {
    expect(hmacSha256(encode("Jefe"), encode("what do ya want for nothing?")).toString("hex")).toBe(
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
    );
  });
});

describe("turunkanKunciMac", () => {
  // Dihitung skrip Python stdlib terpisah: HKDF RFC 5869 dua langkah ditulis manual
  // dengan hmac + hashlib. Extract: PRK = HMAC(salt = 32 byte nol, IKM = byte 0..31).
  // Expand: T(1) = HMAC(PRK, info || 0x01), info = "kyrion v0.2 version-mac", 32 byte.
  const KUNCI_MAC_HEX = "8f86631cc8a04ccbb539f801c87735900ea01e19d7cd3587e3294ea561b8a3a4";

  it("sama dengan acuan HKDF-SHA256 hitungan Python (salt kosong)", () => {
    expect(turunkanKunciMac(KUNCI_INDUK).toString("hex")).toBe(KUNCI_MAC_HEX);
  });

  it("menghasilkan kunci berbeda dari kunci induk lain", () => {
    const lain = Uint8Array.from({ length: 32 }, (_, i) => 31 - i);
    expect(turunkanKunciMac(lain).equals(turunkanKunciMac(KUNCI_INDUK))).toBe(false);
  });

  it("menolak kunci induk yang bukan 32 byte", () => {
    expect(() => turunkanKunciMac(new Uint8Array(31))).toThrow(RangeError);
    expect(() => turunkanKunciMac(new Uint8Array(33))).toThrow(RangeError);
  });
});

describe("buatTagVersi", () => {
  // DATA SINTETIS: id, nomor versi, dan nama berkas fiktif (sama dengan kanonis.test.ts).
  const DATA: DataVersiTerlindung = {
    id: "0196b6a0-3c1e-7b2a-9f4d-5e8a1c2b3d4f",
    regulationId: "0196b6a0-1111-7000-8000-000000000001",
    versionNumber: "2025/2026",
    effectiveDate: "2025-08-01",
    fileSha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    fileName: "pedoman-akademik-é.pdf",
    fileSize: 123456,
  };

  // Known-answer test. Nilai ini dihitung oleh skrip Python stdlib TERPISAH dari kode
  // yang diuji: byte kanonis disusun dengan struct.pack(">I", len) + UTF-8 (NFC), kunci
  // MAC dari HKDF RFC 5869 manual (lihat di atas), lalu hmac.new(kunci_mac, kanonis,
  // hashlib.sha256).hexdigest() diberi awalan "v1$". Bukan keluaran buatTagVersi sendiri.
  const TAG_ACUAN = "v1$795f509677bc95de335ae831d5c7dc1efc3c41049a4644eb23588f4c9b2198b3";

  it("sama dengan tag acuan hitungan Python", () => {
    expect(buatTagVersi(KUNCI_INDUK, DATA)).toBe(TAG_ACUAN);
  });

  it("berformat v1$ + 64 hex huruf kecil", () => {
    expect(buatTagVersi(KUNCI_INDUK, DATA)).toMatch(POLA_TAG);
  });

  it("berubah bila satu field berubah", () => {
    const lain = { ...DATA, fileSize: DATA.fileSize + 1 };
    expect(buatTagVersi(KUNCI_INDUK, lain)).not.toBe(TAG_ACUAN);
  });

  it("berubah bila kunci induk berbeda", () => {
    const lain = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
    expect(buatTagVersi(lain, DATA)).not.toBe(TAG_ACUAN);
  });
});
