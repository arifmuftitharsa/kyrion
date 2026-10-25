"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createChange, deleteChange, findChange, updateChange } from "@/lib/data/changes";
import { getAdminRegulationById, type AdminRegulation } from "@/lib/data/regulations";
import { findVersion, type AdminVersion } from "@/lib/data/versions";
import {
  ChangeNotFoundError,
  pesanTolakHapusPerubahan,
  pesanTolakUbahPerubahan,
} from "@/lib/domain/perubahan";
import { VersionNotEditableError, versiBolehDiubah } from "@/lib/domain/versi-admin";
import {
  skemaIdPerubahan,
  skemaIdRegulasi,
  skemaIdVersi,
  skemaPerubahan,
  type MasukanPerubahan,
} from "@/lib/skema";
import { wajibAdmin } from "@/lib/sesi";
import type { StatusForm } from "@/lib/status-form";
import type { VersionStatus } from "@/lib/types";

const PESAN_VERSI_TIDAK_ADA = "Versi tidak ditemukan atau sudah dihapus.";
const PESAN_PERUBAHAN_TIDAK_ADA = "Perubahan tidak ditemukan atau sudah dihapus.";

/**
 * ID dari argumen terikat (.bind) bisa dimanipulasi klien: format divalidasi dan
 * versi harus milik regulasi itu (kepemilikan berantai regulasi, versi, Change).
 */
async function cariTarget(
  regulationId: string,
  versionId: string,
): Promise<{ regulasi?: AdminRegulation; versi?: AdminVersion }> {
  if (!skemaIdRegulasi.safeParse(regulationId).success) return {};
  if (!skemaIdVersi.safeParse(versionId).success) return {};
  const regulasi = await getAdminRegulationById(regulationId);
  if (!regulasi) return {};
  return { regulasi, versi: await findVersion(regulationId, versionId) };
}

/** Status dibaca ulang setelah mutasi bersyarat gagal, untuk pesan yang tepat. */
async function pesanSetelahGagal(
  regulationId: string,
  versionId: string,
  pesanTolak: (status: VersionStatus) => string,
): Promise<string> {
  const terbaru = await findVersion(regulationId, versionId);
  if (!terbaru) return PESAN_VERSI_TIDAK_ADA;
  return versiBolehDiubah(terbaru.status)
    ? "Perubahan gagal disimpan. Muat ulang halaman, lalu coba lagi."
    : pesanTolak(terbaru.status);
}

type HasilMasukan =
  | { ok: true; masukan: MasukanPerubahan; nilai: Record<string, string> }
  | { ok: false; status: StatusForm };

function periksaMasukan(formData: FormData): HasilMasukan {
  const mentah = Object.fromEntries(formData);
  const nilai = {
    description: String(mentah.description ?? ""),
    source: String(mentah.source ?? ""),
    page: String(mentah.page ?? ""),
  };
  const hasil = skemaPerubahan.safeParse(mentah);
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
  return { ok: true, masukan: hasil.data, nilai };
}

function kembaliKe(regulasi: AdminRegulation, versi: AdminVersion): string {
  return `/admin/regulasi/${regulasi.slug}/versi/${versi.id}/perubahan`;
}

export async function simpanPerubahan(
  regulationId: string,
  versionId: string,
  _sebelumnya: StatusForm,
  formData: FormData,
): Promise<StatusForm> {
  // Server Action adalah endpoint publik: sesi dicek di sini, di luar try.
  await wajibAdmin();

  const { regulasi, versi } = await cariTarget(regulationId, versionId);
  if (!regulasi || !versi) return { pesan: PESAN_VERSI_TIDAK_ADA };
  // Pra-cek untuk pesan cepat; penjaga sebenarnya adalah kunci baris versi di lib/data.
  if (!versiBolehDiubah(versi.status)) return { pesan: pesanTolakUbahPerubahan(versi.status) };

  const hasil = periksaMasukan(formData);
  if (!hasil.ok) return hasil.status;

  try {
    await createChange(regulationId, versionId, hasil.masukan);
  } catch (e) {
    if (e instanceof VersionNotEditableError) {
      return { pesan: await pesanSetelahGagal(regulationId, versionId, pesanTolakUbahPerubahan) };
    }
    console.error("simpanPerubahan gagal:", e);
    return { pesan: "Perubahan gagal disimpan. Coba lagi.", nilai: hasil.nilai };
  }

  // redirect() melempar, jadi sengaja di luar try.
  revalidatePath("/", "layout");
  redirect(kembaliKe(regulasi, versi));
}

export async function ubahPerubahan(
  regulationId: string,
  versionId: string,
  changeId: string,
  _sebelumnya: StatusForm,
  formData: FormData,
): Promise<StatusForm> {
  await wajibAdmin();

  const { regulasi, versi } = await cariTarget(regulationId, versionId);
  if (!regulasi || !versi) return { pesan: PESAN_VERSI_TIDAK_ADA };
  if (!skemaIdPerubahan.safeParse(changeId).success || !(await findChange(versionId, changeId))) {
    return { pesan: PESAN_PERUBAHAN_TIDAK_ADA };
  }
  if (!versiBolehDiubah(versi.status)) return { pesan: pesanTolakUbahPerubahan(versi.status) };

  const hasil = periksaMasukan(formData);
  if (!hasil.ok) return hasil.status;

  try {
    await updateChange(regulationId, versionId, changeId, hasil.masukan);
  } catch (e) {
    if (e instanceof ChangeNotFoundError) return { pesan: PESAN_PERUBAHAN_TIDAK_ADA };
    if (e instanceof VersionNotEditableError) {
      return { pesan: await pesanSetelahGagal(regulationId, versionId, pesanTolakUbahPerubahan) };
    }
    console.error("ubahPerubahan gagal:", e);
    return { pesan: "Perubahan gagal disimpan. Coba lagi.", nilai: hasil.nilai };
  }

  revalidatePath("/", "layout");
  redirect(kembaliKe(regulasi, versi));
}

// Dipakai lewat useActionState; status sebelumnya dan FormData tidak dibutuhkan.
export async function hapusPerubahan(
  regulationId: string,
  versionId: string,
  changeId: string,
): Promise<StatusForm> {
  await wajibAdmin();

  const { regulasi, versi } = await cariTarget(regulationId, versionId);
  if (!regulasi || !versi) return { pesan: PESAN_VERSI_TIDAK_ADA };
  if (!skemaIdPerubahan.safeParse(changeId).success || !(await findChange(versionId, changeId))) {
    return { pesan: PESAN_PERUBAHAN_TIDAK_ADA };
  }
  if (!versiBolehDiubah(versi.status)) return { pesan: pesanTolakHapusPerubahan(versi.status) };

  try {
    await deleteChange(regulationId, versionId, changeId);
  } catch (e) {
    if (e instanceof ChangeNotFoundError) return { pesan: PESAN_PERUBAHAN_TIDAK_ADA };
    if (e instanceof VersionNotEditableError) {
      return { pesan: await pesanSetelahGagal(regulationId, versionId, pesanTolakHapusPerubahan) };
    }
    console.error("hapusPerubahan gagal:", e);
    return { pesan: "Perubahan gagal dihapus. Coba lagi." };
  }

  revalidatePath("/", "layout");
  redirect(kembaliKe(regulasi, versi));
}
