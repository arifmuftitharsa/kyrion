import { buatMasalah } from "@/lib/api/masalah";
import { bacaKonfigurasiAuth } from "@/lib/auth/konfigurasi";

/**
 * Next.js hanya memeriksa Origin untuk Server Action, bukan Route Handler, dan Better Auth
 * tidak mengekspor pemeriksaannya. Maka rute berbasis cookie (POST, DELETE) memeriksanya sendiri.
 * Tanpa Origin = ditolak (tanpa fallback Referer). "null" tidak pernah sama dengan origin sah.
 */
export function originSah(origin: string | null, diizinkan: string): boolean {
  return origin !== null && origin === diizinkan;
}

/** null = lanjut; selain itu respons 403. Origin yang diizinkan = origin BETTER_AUTH_URL. */
export function periksaOrigin(request: Request): Response | null {
  const diizinkan = new URL(bacaKonfigurasiAuth(process.env).BETTER_AUTH_URL).origin;
  if (originSah(request.headers.get("origin"), diizinkan)) return null;
  return buatMasalah("forbidden", request, { detail: "Origin tidak diizinkan." });
}
