"use server";

import { fingerprint } from "@/lib/crypto/fingerprint";
import { verifikasiBerkasDenganDb } from "@/lib/data/verifikasi-berkas";
import { PDF_MAGIC, ambilBerkasOpsional, validasiBerkasPdf } from "@/lib/domain/berkas-pdf";
import { wajibAdmin } from "@/lib/sesi";
import type { StatusPeriksa } from "./status";

const PESAN_BERKAS_WAJIB = "Pilih berkas PDF yang akan diperiksa.";
const PESAN_GALAT_UMUM = "Pemeriksaan tidak dapat dilakukan saat ini. Coba lagi, atau hubungi pengelola sistem.";

/**
 * Berkas hanya dibaca ke memori untuk dihitung SHA-256 (F-30); tidak disimpan, tidak dicatat
 * ke log, dan tidak dikembalikan ke klien. Galat operasional bukan hasil verifikasi.
 */
export async function periksaBerkas(_sebelumnya: StatusPeriksa, formData: FormData): Promise<StatusPeriksa> {
  // Server Action adalah endpoint publik: sesi dicek di sini, di luar try.
  await wajibAdmin();

  const entri = ambilBerkasOpsional(formData.get("berkas"));
  if (!entri) return { galatBerkas: PESAN_BERKAS_WAJIB };
  const awal = new Uint8Array(await entri.slice(0, PDF_MAGIC.length).arrayBuffer());
  const galat = validasiBerkasPdf({ size: entri.size, awal });
  if (galat) return { galatBerkas: galat };

  try {
    const bytes = new Uint8Array(await entri.arrayBuffer());
    return { hasil: await verifikasiBerkasDenganDb(bytes, fingerprint(bytes)) };
  } catch (e) {
    // Hanya nama galat: pesan atau stack bisa membawa jejak data.
    console.error("periksaBerkas gagal:", e instanceof Error ? e.name : "galat tidak dikenal");
    return { pesan: PESAN_GALAT_UMUM };
  }
}
