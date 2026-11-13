import { createHmac } from "node:crypto";

const LABEL_KUNCI_OTP = "kyrion-otp-v1";

/** Kunci HMAC khusus OTP, diturunkan dari rahasia aplikasi (pemisahan domain lewat label tetap). */
export function turunkanKunciOtp(rahasia: string): Buffer {
  return createHmac("sha256", rahasia).update(LABEL_KUNCI_OTP).digest();
}

/** HMAC-SHA256 heksadesimal; hanya ini yang disimpan di basis data, bukan OTP-nya. */
export function hashOtp(kunci: Buffer, otp: string): string {
  return createHmac("sha256", kunci).update(otp).digest("hex");
}
