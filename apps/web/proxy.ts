import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Pemeriksaan optimistik: hanya mengecek KEBERADAAN cookie sesi Better Auth (termasuk
// nama berawalan __Secure- saat https), bukan keabsahannya. BUKAN otorisasi:
// wajibMasuk()/wajibAdmin() tetap wajib di halaman dan Server Action.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/masuk", request.url));
  }
  return NextResponse.next();
}

// Semua halaman kecuali /masuk (persis atau diikuti "/", bukan /masukan), /api, dan aset
// Next. Harus konstanta literal agar bisa dianalisis statis saat build.
export const config = {
  matcher: ["/((?!masuk(?:/|$)|api(?:/|$)|_next/static|_next/image|favicon\\.ico$).*)"],
};
