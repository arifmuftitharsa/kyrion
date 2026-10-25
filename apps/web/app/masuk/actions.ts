"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { verifikasiKredensialAdmin } from "@/lib/autentikasi";
import { skemaMasuk } from "@/lib/skema";
import { buatSesi, hapusSesi } from "@/lib/sesi";
import type { StatusForm } from "@/lib/status-form";

export async function masuk(
  _sebelumnya: StatusForm,
  formData: FormData,
): Promise<StatusForm> {
  // 1. Validasi bentuk
  const hasil = skemaMasuk.safeParse(Object.fromEntries(formData));
  if (!hasil.success) {
    return { galat: z.flattenError(hasil.error).fieldErrors };
  }

  // 2. Verifikasi terhadap hash scrypt di tabel users. Satu pesan untuk semua
  //    kegagalan agar tidak membocorkan email mana yang terdaftar.
  const admin = await verifikasiKredensialAdmin(hasil.data.email, hasil.data.kataSandi);
  if (!admin) {
    return { pesan: "Email atau kata sandi salah." };
  }

  // 3. Buat sesi, lalu alihkan ke halaman admin
  await buatSesi(admin.id, admin.role);
  redirect("/admin/regulasi");
}

export async function keluar() {
  await hapusSesi();
  redirect("/");
}