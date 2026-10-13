import { describe, expect, it } from "vitest";
import {
  InputTooLargeError,
  MAX_INPUT_BYTES,
  fingerprint,
  verifyFingerprint,
} from "./fingerprint";

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

// Vektor uji resmi FIPS 180-2 dipakai agar kebenaran hash dibandingkan
// dengan acuan standar, bukan dengan keluaran kode itu sendiri.
const SHA256_ABC =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const SHA256_EMPTY =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

describe("fingerprint", () => {
  it('menghasilkan SHA-256 sesuai vektor uji resmi FIPS 180-2 untuk "abc"', () => {
    expect(fingerprint(encode("abc"))).toBe(SHA256_ABC);
  });

  it("menghasilkan SHA-256 yang benar untuk input kosong", () => {
    expect(fingerprint(new Uint8Array(0))).toBe(SHA256_EMPTY);
  });

  it("menerima input tepat sebesar MAX_INPUT_BYTES", () => {
    expect(() => fingerprint(new Uint8Array(MAX_INPUT_BYTES))).not.toThrow();
  });

  it("melempar InputTooLargeError untuk input sebesar MAX_INPUT_BYTES + 1", () => {
    expect(() => fingerprint(new Uint8Array(MAX_INPUT_BYTES + 1))).toThrow(
      InputTooLargeError,
    );
  });
});

describe("verifyFingerprint", () => {
  it("mengembalikan true untuk data asli dan false bila satu byte diubah", () => {
    const original = encode("Pedoman Akademik Program Sarjana v2.0");
    const expectedHex = fingerprint(original);
    expect(verifyFingerprint(original, expectedHex)).toBe(true);

    // Salinan dipakai agar data asli tidak ikut berubah.
    const tampered = original.slice();
    tampered[0] ^= 0x01;
    expect(verifyFingerprint(tampered, expectedHex)).toBe(false);
  });

  it.each([
    ["string bukan hex (64 karakter z)", "z".repeat(64)],
    ["hex 63 karakter", SHA256_ABC.slice(0, 63)],
    ["hex 65 karakter", `${SHA256_ABC}0`],
    ["hex huruf besar dari hash yang benar", SHA256_ABC.toUpperCase()],
    ["string kosong", ""],
  ])("mengembalikan false untuk expectedHex berformat salah: %s", (_label, expectedHex) => {
    expect(verifyFingerprint(encode("abc"), expectedHex)).toBe(false);
  });

  it("melempar InputTooLargeError (bukan mengembalikan false) untuk data di atas MAX_INPUT_BYTES", () => {
    expect(() =>
      verifyFingerprint(new Uint8Array(MAX_INPUT_BYTES + 1), SHA256_EMPTY),
    ).toThrow(InputTooLargeError);
  });
});
