import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Pemeriksaan optimistik: hanya mengecek KEBERADAAN cookie sesi Better Auth (termasuk
// nama berawalan __Secure- saat https), bukan keabsahannya. BUKAN otorisasi:
// wajibAdmin() tetap wajib di halaman dan Server Action.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/masuk", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
