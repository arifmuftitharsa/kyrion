"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cabutSesi } from "@/lib/data/sesi";
import { skemaIdSesi } from "@/lib/skema";
import { wajibMasuk } from "@/lib/sesi";
import type { StatusForm } from "@/lib/status-form";

const PESAN_GAGAL = "Sesi tidak dapat dicabut. Muat ulang halaman, lalu coba lagi.";

// Dipakai lewat useActionState (FormKonfirmasi); id diikat lewat .bind dan bisa dimanipulasi klien.
export async function cabutSesiSaya(id: string): Promise<StatusForm> {
  const sesi = await wajibMasuk();
  if (!skemaIdSesi.safeParse(id).success) return { pesan: PESAN_GAGAL };

  // Pemilik ada di where penghapusan; sesi orang lain sama dengan tidak ada.
  if (!(await cabutSesi(id, sesi.userId))) return { pesan: PESAN_GAGAL };

  // sesiId dibaca sebelum penghapusan. redirect() melempar, jadi di luar try.
  if (id === sesi.sesiId) redirect("/masuk");
  revalidatePath("/akun/sesi");
  return {};
}
