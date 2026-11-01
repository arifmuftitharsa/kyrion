import "server-only";
import { periksaBerkasVersi } from "@/lib/integritas-versi";
import { bacaBerkas } from "@/lib/penyimpanan";
import type { BerkasTersimpan } from "@/lib/types";

// Respons unduhan PDF (F-05) untuk Route Handler publik dan admin. Sebelum dikirim,
// hash berkas di disk dihitung ulang (F-30) dan tag HMAC catatan versi diperiksa (F-31).

function teks(pesan: string, status: number): Response {
  return new Response(pesan, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export function tidakDitemukan(): Response {
  return teks("Berkas tidak ditemukan.", 404);
}

/** Nama untuk header: versi ASCII sebagai cadangan, nama UTF-8 lewat filename*. */
function contentDisposition(nama: string): string {
  const ascii = nama.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nama)}`;
}

export async function responsPdf(berkas: BerkasTersimpan): Promise<Response> {
  let bytes: Buffer;
  try {
    bytes = await bacaBerkas(berkas.key);
  } catch (error) {
    console.error("Berkas tidak dapat dibaca:", berkas.key, error);
    return teks("Berkas tidak ditemukan di penyimpanan.", 500);
  }

  try {
    await periksaBerkasVersi(berkas, bytes);
  } catch (error) {
    // Gagal tertutup untuk galat apa pun (IntegritasGagal, kunci tidak valid, dsb.). Hanya
    // nama galat yang dicatat: pesan atau stack bisa membawa jejak data.
    console.error(
      "Integritas berkas gagal diverifikasi:",
      berkas.key,
      error instanceof Error ? error.name : "galat tidak dikenal",
    );
    return teks("Berkas gagal diverifikasi: isinya tidak sama dengan yang tercatat.", 500);
  }

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.length),
      "Content-Disposition": contentDisposition(berkas.name),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
