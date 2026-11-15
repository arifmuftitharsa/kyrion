import { createPrivateKey } from "node:crypto";
import { describe, expect, it } from "vitest";
import { bangkitkanPasanganKunci, idKunci, tandatangani, verifikasiTandaTangan } from "./tanda-tangan";

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

// Vektor uji RFC 8032 bagian 7.1, TEST 1 (pesan kosong), dari rfc-editor.org.
const RFC_SEED = "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60";
const RFC_PUBLIK = "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a";
const RFC_TANDA_TANGAN =
  "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b";
// Awalan PKCS8 DER Ed25519 + seed mentah; bukan dari berkas PEM.
const PREFIX_PKCS8 = "302e020100300506032b657004220420";
// Awalan SPKI DER Ed25519 + kunci publik mentah.
const PREFIX_SPKI = "302a300506032b6570032100";

const kunciRfc = createPrivateKey({
  key: Buffer.from(PREFIX_PKCS8 + RFC_SEED, "hex"),
  format: "der",
  type: "pkcs8",
});
const publikRfcDer = Buffer.from(PREFIX_SPKI + RFC_PUBLIK, "hex");

describe("RFC 8032 TEST 1", () => {
  it("tandatangani menghasilkan tanda tangan RFC", () => {
    expect(tandatangani(new Uint8Array(0), kunciRfc).toString("hex")).toBe(RFC_TANDA_TANGAN);
  });

  it("verifikasi tanda tangan RFC lolos", () => {
    expect(
      verifikasiTandaTangan(new Uint8Array(0), Buffer.from(RFC_TANDA_TANGAN, "hex"), publikRfcDer),
    ).toBe(true);
  });
});

describe("pasangan kunci dan tanda tangan", () => {
  const { kunciPublikDer, kunciPrivatPem } = bangkitkanPasanganKunci();
  const pesan = encode("pesan uji");
  const tanda = tandatangani(pesan, kunciPrivatPem);

  it("tanda tangan 64 byte dan lolos verifikasi", () => {
    expect(tanda.byteLength).toBe(64);
    expect(verifikasiTandaTangan(pesan, tanda, kunciPublikDer)).toBe(true);
  });

  it("pesan diubah 1 byte: false", () => {
    const ubah = Uint8Array.from(pesan);
    ubah[0] ^= 1;
    expect(verifikasiTandaTangan(ubah, tanda, kunciPublikDer)).toBe(false);
  });

  it("tanda tangan diubah 1 byte: false", () => {
    const ubah = Buffer.from(tanda);
    ubah[0] ^= 1;
    expect(verifikasiTandaTangan(pesan, ubah, kunciPublikDer)).toBe(false);
  });

  it("kunci publik lain: false", () => {
    expect(verifikasiTandaTangan(pesan, tanda, bangkitkanPasanganKunci().kunciPublikDer)).toBe(false);
  });

  it("panjang tanda tangan 63 dan 65 byte: false", () => {
    expect(verifikasiTandaTangan(pesan, tanda.subarray(0, 63), kunciPublikDer)).toBe(false);
    expect(verifikasiTandaTangan(pesan, Buffer.concat([tanda, Buffer.alloc(1)]), kunciPublikDer)).toBe(false);
  });

  it("masukan sampah: false dan tidak melempar", () => {
    expect(verifikasiTandaTangan(pesan, tanda, encode("bukan kunci"))).toBe(false);
    expect(verifikasiTandaTangan(pesan, tanda, new Uint8Array(0))).toBe(false);
    expect(verifikasiTandaTangan(pesan, new Uint8Array(0), kunciPublikDer)).toBe(false);
  });

  it("dua kali tandatangani pesan sama: identik", () => {
    expect(tandatangani(pesan, kunciPrivatPem).equals(tanda)).toBe(true);
  });
});

describe("idKunci", () => {
  it("32 hex huruf kecil, deterministik, beda antarkunci", () => {
    const a = bangkitkanPasanganKunci().kunciPublikDer;
    expect(idKunci(a)).toMatch(/^[0-9a-f]{32}$/);
    expect(idKunci(a)).toBe(idKunci(a));
    expect(idKunci(a)).not.toBe(idKunci(bangkitkanPasanganKunci().kunciPublikDer));
  });
});
