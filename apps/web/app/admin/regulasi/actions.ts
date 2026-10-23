"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { skemaRegulasi } from "@/lib/skema";
import { addRegulation, createSlug, isSlugTaken } from "@/lib/data/regulations";
import type { StatusForm } from "@/lib/status-form";

export async function simpanRegulasi(
  _sebelumnya: StatusForm,
  formData: FormData,
): Promise<StatusForm> {
  // 1. Sesi: ditambahkan di Bagian 4

  const mentah = Object.fromEntries(formData);
  const nilai = {
    name: String(mentah.name ?? ""),
    category: String(mentah.category ?? ""),
    description: String(mentah.description ?? ""),
  };

  // 2. Validasi bentuk (skema Zod)
  const hasil = skemaRegulasi.safeParse(mentah);
  if (!hasil.success) {
    return {
      galat: z.flattenError(hasil.error).fieldErrors,
      pesan: "Periksa kembali isian formulir.",
      nilai,
    };
  }

  // 3. Validasi semantik (butuh data tersimpan)
  const slug = createSlug(hasil.data.name);
  if (slug === "") {
    return { galat: { name: ["Nama harus mengandung huruf atau angka"] }, nilai };
  }
  if (isSlugTaken(slug)) {
    return { galat: { name: ["Regulasi dengan nama ini sudah ada"] }, nilai };
  }

  // 4. Mutasi
  let slugBaru: string;
  try {
    slugBaru = addRegulation(hasil.data).slug;
  } catch (e) {
    console.error("simpanRegulasi gagal:", e);
    return { pesan: "Regulasi gagal disimpan. Coba lagi.", nilai };
  }

  // 5. Revalidasi lalu redirect, sengaja DI LUAR try
  revalidatePath("/");
  redirect(`/regulasi/${slugBaru}`);
}