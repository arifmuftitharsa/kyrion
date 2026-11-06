"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createCategory,
  deleteEmptyCategory,
  findCategoryById,
  isCategorySlugTaken,
  renameCategory,
} from "@/lib/data/categories";
import {
  CategoryHasRegulationsError,
  CategoryNotFoundError,
  CategorySlugTakenError,
  kategoriBolehDihapus,
  pesanTolakHapusKategori,
} from "@/lib/domain/kategori";
import { createSlug } from "@/lib/domain/slug";
import { skemaIdKategori, skemaKategori } from "@/lib/skema";
import { wajibAdmin } from "@/lib/sesi";
import type { StatusForm } from "@/lib/status-form";

const GALAT_NAMA_SERUPA = { name: ["Kategori dengan nama serupa sudah ada"] };
const PESAN_TIDAK_DITEMUKAN = "Kategori tidak ditemukan atau sudah dihapus.";

type HasilMasukan =
  | { ok: true; name: string; slug: string; nilai: Record<string, string> }
  | { ok: false; status: StatusForm };

/**
 * Validasi bentuk (Zod) lalu semantik (slug) yang sama untuk tambah dan ganti nama.
 * Nama mirip (beda huruf besar-kecil/spasi) menghasilkan slug yang sama, jadi ditolak.
 */
async function periksaMasukan(formData: FormData, exceptId?: string): Promise<HasilMasukan> {
  const mentah = Object.fromEntries(formData);
  const nilai = { name: String(mentah.name ?? "") };

  const hasil = skemaKategori.safeParse(mentah);
  if (!hasil.success) {
    return {
      ok: false,
      status: {
        galat: z.flattenError(hasil.error).fieldErrors,
        pesan: "Periksa kembali isian formulir.",
        nilai,
      },
    };
  }

  const slug = createSlug(hasil.data.name);
  if (slug === "") {
    return { ok: false, status: { galat: { name: ["Nama harus mengandung huruf atau angka"] }, nilai } };
  }
  if (await isCategorySlugTaken(slug, exceptId)) {
    return { ok: false, status: { galat: GALAT_NAMA_SERUPA, nilai } };
  }

  return { ok: true, name: hasil.data.name, slug, nilai };
}

export async function simpanKategori(
  _sebelumnya: StatusForm,
  formData: FormData,
): Promise<StatusForm> {
  // Server Action adalah endpoint publik: sesi dicek di sini, di luar try.
  await wajibAdmin();

  const hasil = await periksaMasukan(formData);
  if (!hasil.ok) return hasil.status;

  try {
    await createCategory(hasil.name, hasil.slug);
  } catch (e) {
    // Slug bisa direbut request lain setelah pra-cek; tetap jadi galat field.
    if (e instanceof CategorySlugTakenError) return { galat: GALAT_NAMA_SERUPA, nilai: hasil.nilai };
    console.error("simpanKategori gagal:", e);
    return { pesan: "Kategori gagal disimpan. Coba lagi.", nilai: hasil.nilai };
  }

  // redirect() melempar, jadi sengaja di luar try.
  revalidatePath("/", "layout");
  redirect("/admin/kategori");
}

export async function gantiNamaKategori(
  id: string,
  _sebelumnya: StatusForm,
  formData: FormData,
): Promise<StatusForm> {
  await wajibAdmin();

  const idValid = skemaIdKategori.safeParse(id);
  if (!idValid.success) return { pesan: PESAN_TIDAK_DITEMUKAN };

  // Slug ikut nama baru; kategori ini sendiri dikecualikan dari cek unik.
  const hasil = await periksaMasukan(formData, idValid.data);
  if (!hasil.ok) return hasil.status;

  try {
    await renameCategory(idValid.data, hasil.name, hasil.slug);
  } catch (e) {
    if (e instanceof CategorySlugTakenError) return { galat: GALAT_NAMA_SERUPA, nilai: hasil.nilai };
    if (e instanceof CategoryNotFoundError) return { pesan: PESAN_TIDAK_DITEMUKAN, nilai: hasil.nilai };
    console.error("gantiNamaKategori gagal:", e);
    return { pesan: "Kategori gagal disimpan. Coba lagi.", nilai: hasil.nilai };
  }

  revalidatePath("/", "layout");
  redirect("/admin/kategori");
}

// Dipakai lewat useActionState; status sebelumnya dan FormData tidak dibutuhkan.
export async function hapusKategori(id: string): Promise<StatusForm> {
  await wajibAdmin();

  const idValid = skemaIdKategori.safeParse(id);
  if (!idValid.success) return { pesan: PESAN_TIDAK_DITEMUKAN };

  // Pra-cek memberi pesan yang tepat (jumlah regulasi) sebelum menyentuh constraint.
  const kategori = await findCategoryById(idValid.data);
  if (!kategori) return { pesan: PESAN_TIDAK_DITEMUKAN };
  if (!kategoriBolehDihapus(kategori.regulationCount)) {
    return { pesan: pesanTolakHapusKategori(kategori.regulationCount) };
  }

  try {
    await deleteEmptyCategory(idValid.data);
  } catch (e) {
    // Regulasi bisa ditambahkan request lain setelah pra-cek.
    if (e instanceof CategoryHasRegulationsError) {
      const terbaru = await findCategoryById(idValid.data);
      return { pesan: pesanTolakHapusKategori(terbaru?.regulationCount ?? 1) };
    }
    if (e instanceof CategoryNotFoundError) return { pesan: PESAN_TIDAK_DITEMUKAN };
    console.error("hapusKategori gagal:", e);
    return { pesan: "Kategori gagal dihapus. Coba lagi." };
  }

  revalidatePath("/", "layout");
  redirect("/admin/kategori");
}
