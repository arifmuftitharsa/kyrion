"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createRegulation,
  deleteRegulation,
  getAdminRegulationById,
  isSlugTaken,
  updateRegulation,
} from "@/lib/data/regulations";
import {
  RegulationHasVersionsError,
  RegulationNotFoundError,
  SlugTakenError,
  pesanTolakHapus,
  regulasiBolehDihapus,
} from "@/lib/domain/regulasi";
import { createSlug } from "@/lib/domain/slug";
import { skemaIdRegulasi, skemaRegulasi, type MasukanRegulasi } from "@/lib/skema";
import { wajibAdmin } from "@/lib/sesi";
import type { StatusForm } from "@/lib/status-form";

const GALAT_SLUG_TERPAKAI = { name: ["Regulasi dengan nama ini sudah ada"] };
const PESAN_TIDAK_DITEMUKAN = "Regulasi tidak ditemukan atau sudah dihapus.";

type HasilMasukan =
  | { ok: true; masukan: MasukanRegulasi; slug: string; nilai: Record<string, string> }
  | { ok: false; status: StatusForm };

/**
 * Validasi bentuk (Zod) lalu semantik (slug) yang sama untuk tambah dan ubah.
 * `exceptId` dikecualikan saat cek slug agar regulasi tidak bentrok dengan dirinya.
 */
async function periksaMasukan(formData: FormData, exceptId?: string): Promise<HasilMasukan> {
  const mentah = Object.fromEntries(formData);
  const nilai = {
    name: String(mentah.name ?? ""),
    category: String(mentah.category ?? ""),
    description: String(mentah.description ?? ""),
  };

  const hasil = skemaRegulasi.safeParse(mentah);
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
  if (await isSlugTaken(slug, exceptId)) {
    return { ok: false, status: { galat: GALAT_SLUG_TERPAKAI, nilai } };
  }

  return { ok: true, masukan: hasil.data, slug, nilai };
}

export async function simpanRegulasi(
  _sebelumnya: StatusForm,
  formData: FormData,
): Promise<StatusForm> {
  // Server Action adalah endpoint publik: sesi dicek di sini, di luar try.
  await wajibAdmin();

  const hasil = await periksaMasukan(formData);
  if (!hasil.ok) return hasil.status;

  try {
    await createRegulation(hasil.masukan, hasil.slug);
  } catch (e) {
    // Slug bisa direbut request lain setelah pra-cek; tetap jadi galat field.
    if (e instanceof SlugTakenError) return { galat: GALAT_SLUG_TERPAKAI, nilai: hasil.nilai };
    console.error("simpanRegulasi gagal:", e);
    return { pesan: "Regulasi gagal disimpan. Coba lagi.", nilai: hasil.nilai };
  }

  // redirect() melempar, jadi sengaja di luar try.
  revalidatePath("/", "layout");
  redirect("/admin/regulasi");
}

export async function ubahRegulasi(
  id: string,
  _sebelumnya: StatusForm,
  formData: FormData,
): Promise<StatusForm> {
  await wajibAdmin();

  const idValid = skemaIdRegulasi.safeParse(id);
  if (!idValid.success) return { pesan: PESAN_TIDAK_DITEMUKAN };

  // Slug ikut nama baru; regulasi ini sendiri dikecualikan dari cek unik.
  const hasil = await periksaMasukan(formData, idValid.data);
  if (!hasil.ok) return hasil.status;

  try {
    await updateRegulation(idValid.data, hasil.masukan, hasil.slug);
  } catch (e) {
    if (e instanceof SlugTakenError) return { galat: GALAT_SLUG_TERPAKAI, nilai: hasil.nilai };
    if (e instanceof RegulationNotFoundError) return { pesan: PESAN_TIDAK_DITEMUKAN, nilai: hasil.nilai };
    console.error("ubahRegulasi gagal:", e);
    return { pesan: "Regulasi gagal disimpan. Coba lagi.", nilai: hasil.nilai };
  }

  revalidatePath("/", "layout");
  redirect("/admin/regulasi");
}

// Dipakai lewat useActionState; status sebelumnya dan FormData tidak dibutuhkan.
export async function hapusRegulasi(id: string): Promise<StatusForm> {
  await wajibAdmin();

  const idValid = skemaIdRegulasi.safeParse(id);
  if (!idValid.success) return { pesan: PESAN_TIDAK_DITEMUKAN };

  // Pra-cek memberi pesan yang tepat (jumlah versi) sebelum menyentuh constraint.
  const regulasi = await getAdminRegulationById(idValid.data);
  if (!regulasi) return { pesan: PESAN_TIDAK_DITEMUKAN };
  if (!regulasiBolehDihapus(regulasi.versionCount)) {
    return { pesan: pesanTolakHapus(regulasi.versionCount) };
  }

  try {
    await deleteRegulation(idValid.data);
  } catch (e) {
    // Versi bisa ditambahkan request lain setelah pra-cek; Restrict di DB menolak.
    if (e instanceof RegulationHasVersionsError) {
      const terbaru = await getAdminRegulationById(idValid.data);
      return { pesan: pesanTolakHapus(terbaru?.versionCount ?? 1) };
    }
    if (e instanceof RegulationNotFoundError) return { pesan: PESAN_TIDAK_DITEMUKAN };
    console.error("hapusRegulasi gagal:", e);
    return { pesan: "Regulasi gagal dihapus. Coba lagi." };
  }

  revalidatePath("/", "layout");
  redirect("/admin/regulasi");
}
