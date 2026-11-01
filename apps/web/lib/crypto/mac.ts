import { createHmac, hkdfSync } from "node:crypto";
import { kanonisasiVersi, type DataVersiTerlindung } from "./kanonis";

// HMAC-SHA256 untuk tag integritas versi (F-31). Beda dengan fingerprint (F-30):
// fingerprint hanya hash polos yang bisa dihitung siapa saja, sedangkan tag butuh
// kunci rahasia yang tidak disimpan di basis data.

export const INFO_KUNCI_MAC = "kyrion v0.2 version-mac";

const AWALAN_TAG = "v1$";
const KUNCI_INDUK_BYTES = 32;
const KUNCI_MAC_BYTES = 32;

/** Format tag yang sah: "v1$" + 64 hex huruf kecil (HMAC-SHA256 = 32 byte). */
export const POLA_TAG = /^v1\$[0-9a-f]{64}$/;

/** HMAC-SHA256 (RFC 2104 / RFC 4231). */
export function hmacSha256(key: Uint8Array, data: Uint8Array): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

/**
 * Menurunkan kunci HMAC dari kunci induk dengan HKDF-SHA256 (RFC 5869), salt kosong.
 * `info` mengikat kunci turunan pada tujuannya: kunci induk yang sama bisa dipakai
 * fitur lain nanti dengan `info` berbeda tanpa menghasilkan kunci yang sama.
 */
export function turunkanKunciMac(kunciInduk: Uint8Array): Buffer {
  if (kunciInduk.byteLength !== KUNCI_INDUK_BYTES) {
    throw new RangeError(`Kunci induk harus ${KUNCI_INDUK_BYTES} byte.`);
  }
  const turunan = hkdfSync("sha256", kunciInduk, Buffer.alloc(0), INFO_KUNCI_MAC, KUNCI_MAC_BYTES);
  return Buffer.from(turunan);
}

/**
 * Tag versi: "v1$" + hex HMAC-SHA256 atas byte kanonis. Awalan "v1" memungkinkan
 * format atau kunci diganti nanti tanpa membuat tag lama ambigu.
 */
export function buatTagVersi(kunciInduk: Uint8Array, data: DataVersiTerlindung): string {
  const mac = hmacSha256(turunkanKunciMac(kunciInduk), kanonisasiVersi(data));
  return AWALAN_TAG + mac.toString("hex");
}
