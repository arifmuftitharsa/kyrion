// Allowlist endpoint Better Auth (default-tolak: endpoint baru dari pembaruan versi otomatis ditolak).
// Kunci = path templat endpoint (sama dengan ctx.path di hooks.before), nilai = metode HTTP yang diizinkan.
export const ENDPOINT_DIIZINKAN: Readonly<Record<string, readonly string[]>> = {
  "/ok": ["GET"],
  "/error": ["GET"],
  "/get-session": ["GET"],
  "/sign-out": ["POST"],
  "/email-otp/send-verification-otp": ["POST"],
  "/sign-in/email-otp": ["POST"],
};

/**
 * Tanpa metode = panggilan auth.api.* dari kode server kita sendiri: dilewatkan. Setiap permintaan
 * HTTP lewat router selalu membawa ctx.request (better-call router.mjs), jadi klien tidak bisa
 * memakai jalur ini. Dengan metode, path dan metode wajib ada di allowlist.
 */
export function permintaanDiizinkan(path: string | undefined, metode: string | undefined): boolean {
  if (metode === undefined) return true;
  if (path === undefined || !Object.hasOwn(ENDPOINT_DIIZINKAN, path)) return false;
  return ENDPOINT_DIIZINKAN[path].includes(metode.toUpperCase());
}
