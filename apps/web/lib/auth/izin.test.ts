import { describe, expect, it } from "vitest";
import { permintaanDiizinkan } from "./izin";

// Daftar endpoint ber-path Better Auth 1.7.22 (inti + emailOTP) beserta metodenya.
const DITOLAK: ReadonlyArray<[string, string]> = [
  ["/sign-in/social", "POST"], ["/sign-in/email", "POST"], ["/sign-up/email", "POST"],
  ["/callback/:id", "GET"], ["/callback/:id", "POST"],
  ["/update-session", "POST"], ["/update-user", "POST"], ["/change-password", "POST"],
  ["/change-email", "POST"], ["/delete-user", "POST"], ["/delete-user/callback", "GET"],
  ["/list-sessions", "GET"], ["/revoke-session", "POST"], ["/revoke-sessions", "POST"],
  ["/revoke-other-sessions", "POST"], ["/request-password-reset", "POST"],
  ["/reset-password", "POST"], ["/reset-password/:token", "GET"], ["/verify-password", "POST"],
  ["/send-verification-email", "POST"], ["/verify-email", "GET"],
  ["/list-accounts", "GET"], ["/account-info", "GET"], ["/link-social", "POST"],
  ["/unlink-account", "POST"], ["/get-access-token", "POST"], ["/refresh-token", "POST"],
  ["/email-otp/check-verification-otp", "POST"], ["/email-otp/verify-email", "POST"],
  ["/email-otp/request-password-reset", "POST"], ["/email-otp/reset-password", "POST"],
  ["/email-otp/request-email-change", "POST"], ["/email-otp/change-email", "POST"],
  ["/forget-password/email-otp", "POST"],
];

describe("permintaanDiizinkan", () => {
  it.each([
    ["/ok", "GET"], ["/error", "GET"], ["/get-session", "GET"], ["/sign-out", "POST"],
    ["/email-otp/send-verification-otp", "POST"], ["/sign-in/email-otp", "POST"],
  ])("menerima %s %s", (p, m) => expect(permintaanDiizinkan(p, m)).toBe(true));

  it.each([
    ["/ok", "POST"], ["/get-session", "POST"], ["/sign-in/email-otp", "GET"], ["/sign-out", "GET"],
  ])("menolak metode salah %s %s", (p, m) => expect(permintaanDiizinkan(p, m)).toBe(false));

  it.each(DITOLAK)("menolak %s %s", (p, m) => expect(permintaanDiizinkan(p, m)).toBe(false));

  it("menolak path tak dikenal, kosong, dan kunci prototipe", () => {
    expect(permintaanDiizinkan("/endpoint-baru", "POST")).toBe(false);
    expect(permintaanDiizinkan(undefined, "GET")).toBe(false);
    expect(permintaanDiizinkan("toString", "GET")).toBe(false);
  });

  it("tanpa metode (panggilan auth.api dari server) lolos untuk path apa pun", () => {
    expect(permintaanDiizinkan("/list-sessions", undefined)).toBe(true);
    expect(permintaanDiizinkan(undefined, undefined)).toBe(true);
  });
});
