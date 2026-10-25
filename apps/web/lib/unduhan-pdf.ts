import "server-only";
import { verifyFingerprint } from "@/lib/crypto/fingerprint";
import { bacaBerkas } from "@/lib/penyimpanan";
import type { BerkasTersimpan } from "@/lib/types";

// Respons unduhan PDF (F-05) untuk Route Handler publik dan admin. Hash berkas
// di disk dihitung ulang dan dibandingkan dengan hash di DB sebelum dikirim.

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

  let cocok: boolean;
  try {
    cocok = verifyFingerprint(bytes, berkas.sha256);
  } catch {
    // InputTooLargeError: berkas di disk membesar melewati batas, jelas tidak cocok.
    cocok = false;
  }
  if (!cocok) {
    console.error("Hash berkas tidak cocok dengan catatan DB:", berkas.key);
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
