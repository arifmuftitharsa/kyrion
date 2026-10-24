"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
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

  // 2. Cocokkan dengan akun demo (sementara; autentikasi sebenarnya di Modul 10-11)
  const { email, kataSandi } = hasil.data;
  if (email !== process.env.DEMO_EMAIL || kataSandi !== process.env.DEMO_KATA_SANDI) {
    return { pesan: "Email atau kata sandi salah." };
  }

  // 3. Buat sesi, lalu alihkan ke halaman admin
  await buatSesi(email);
  redirect("/admin/regulasi");
}

export async function keluar() {
  await hapusSesi();
  redirect("/");
}