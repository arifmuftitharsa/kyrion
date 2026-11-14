import "server-only";
import { type Syarat, putuskanAkses } from "@/lib/akses/keputusan";
import { buatMasalah } from "@/lib/api/masalah";
import { type SesiPengguna, bacaSesi } from "@/lib/sesi";

/**
 * Adapter Route Handler: tanpa redirect() dan notFound(), karena klien bukan peramban.
 * Anonim 401, peran tak cukup 403. "problem" = application/problem+json; "teks" = teks biasa.
 */
export async function jagaRoute(
  syarat: Syarat,
  request: Request,
  bentuk: "problem" | "teks",
): Promise<{ sesi: SesiPengguna } | { respons: Response }> {
  const sesi = await bacaSesi();
  const keputusan = putuskanAkses(sesi, syarat);
  if (keputusan === "masuk") {
    return {
      respons:
        bentuk === "problem"
          ? buatMasalah("unauthenticated", request, { detail: "Perlu masuk." })
          : teks("Perlu masuk.", 401),
    };
  }
  if (keputusan === "tolak" || !sesi) {
    return {
      respons:
        bentuk === "problem"
          ? buatMasalah("forbidden", request, { detail: "Tidak diizinkan." })
          : teks("Tidak diizinkan.", 403),
    };
  }
  return { sesi };
}

function teks(isi: string, status: number): Response {
  return new Response(isi, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
