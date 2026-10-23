import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Pemeriksaan optimistik: hanya mengecek KEBERADAAN cookie, bukan keabsahannya.
// Keabsahan sesi tetap diperiksa bacaSesi() di halaman dan Server Action.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("sesi")) {
    return NextResponse.redirect(new URL("/masuk", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};