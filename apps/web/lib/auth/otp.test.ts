import { describe, expect, it } from "vitest";
import { hashOtp, turunkanKunciOtp } from "./otp";

const kunci = turunkanKunciOtp("rahasia-uji-".repeat(3));

describe("turunkanKunciOtp", () => {
  it("deterministik; rahasia beda → kunci beda", () => {
    expect(turunkanKunciOtp("a".repeat(32)).equals(turunkanKunciOtp("a".repeat(32)))).toBe(true);
    expect(turunkanKunciOtp("a".repeat(32)).equals(turunkanKunciOtp("b".repeat(32)))).toBe(false);
  });
});

describe("hashOtp", () => {
  it("deterministik", () => {
    expect(hashOtp(kunci, "123456")).toBe(hashOtp(kunci, "123456"));
  });
  it("OTP beda → hasil beda", () => {
    expect(hashOtp(kunci, "123456")).not.toBe(hashOtp(kunci, "123457"));
  });
  it("rahasia beda → hasil beda", () => {
    expect(hashOtp(kunci, "123456")).not.toBe(hashOtp(turunkanKunciOtp("z".repeat(32)), "123456"));
  });
  it("keluaran heksadesimal 64 karakter dan tidak memuat OTP", () => {
    for (const otp of ["000000", "123456", "987654"]) {
      const h = hashOtp(kunci, otp);
      expect(h).toMatch(/^[0-9a-f]{64}$/);
      expect(h).not.toContain(otp);
    }
  });
});
