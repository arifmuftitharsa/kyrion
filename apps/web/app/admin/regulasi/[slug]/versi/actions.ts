"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminRegulationById, type AdminRegulation } from "@/lib/data/regulations";
import {
  createVersion,
  deleteDraftVersion,
  findVersion,
  updateDraftVersion,
  type AdminVersion,
} from "@/lib/data/versions";
import { RegulationNotFoundError } from "@/lib/domain/regulasi";
import {
  VersionNotEditableError,
  VersionNumberTakenError,
  pesanTolakHapusVersi,
  pesanTolakUbahVersi,
  versiBolehDihapus,
  versiBolehDiubah,
} from "@/lib/domain/versi-admin";
import { skemaIdRegulasi, skemaIdVersi, skemaVersi, type MasukanVersi } from "@/lib/skema";
import { wajibAdmin } from "@/lib/sesi";
import type { StatusForm } from "@/lib/status-form";
import type { VersionStatus } from "@/lib/types";

const GALAT_NOMOR_TERPAKAI = { versionNumber: ["Nomor versi ini sudah dipakai pada regulasi ini"] };
const PESAN_REGULASI_TIDAK_ADA = "Regulasi tidak ditemukan atau sudah dihapus.";
const PESAN_VERSI_TIDAK_ADA = "Versi tidak ditemukan atau sudah dihapus.";

type HasilMasukan =
  | { ok: true; masukan: MasukanVersi; nilai: Record<string, string> }
  | { ok: false; status: StatusForm };

function periksaMasukan(formData: FormData): HasilMasukan {
  const mentah = Object.fromEntries(formData);
  const nilai = {
    versionNumber: String(mentah.versionNumber ?? ""),
    effectiveDay: String(mentah.effectiveDay ?? ""),
    effectiveMonth: String(mentah.effectiveMonth ?? ""),
    effectiveYear: String(mentah.effectiveYear ?? ""),
    changeSummary: String(mentah.changeSummary ?? ""),
  };
  const hasil = skemaVersi.safeParse(mentah);
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

/**
 * ID dari argumen terikat (.bind) bisa dimanipulasi klien: format divalidasi,
 * regulasi harus ada, dan versi (bila diminta) harus milik regulasi itu.
 */
async function cariTarget(
  regulationId: string,
  versionId?: string,
): Promise<{ regulasi?: AdminRegulation; versi?: AdminVersion; pesan?: string }> {
  if (!skemaIdRegulasi.safeParse(regulationId).success) return { pesan: PESAN_REGULASI_TIDAK_ADA };
  const regulasi = await getAdminRegulationById(regulationId);
  if (!regulasi) return { pesan: PESAN_REGULASI_TIDAK_ADA };
  if (versionId === undefined) return { regulasi };

  if (!skemaIdVersi.safeParse(versionId).success) return { pesan: PESAN_VERSI_TIDAK_ADA };
  const versi = await findVersion(regulationId, versionId);
  if (!versi) return { pesan: PESAN_VERSI_TIDAK_ADA };
  return { regulasi, versi };
}

/** Status dibaca ulang setelah mutasi bersyarat gagal, untuk pesan yang tepat. */
async function pesanSetelahGagal(
  regulationId: string,
  versionId: string,
  pesanTolak: (status: VersionStatus) => string,
): Promise<string> {
  const terbaru = await findVersion(regulationId, versionId);
  return terbaru ? pesanTolak(terbaru.status) : PESAN_VERSI_TIDAK_ADA;
}

export async function simpanVersi(
  regulationId: string,
  _sebelumnya: StatusForm,
  formData: FormData,
): Promise<StatusForm> {
  // Server Action adalah endpoint publik: sesi dicek di sini, di luar try.
  await wajibAdmin();

  const target = await cariTarget(regulationId);
  if (!target.regulasi) return { pesan: target.pesan };

  const hasil = periksaMasukan(formData);
  if (!hasil.ok) return hasil.status;

  try {
    await createVersion(regulationId, hasil.masukan);
  } catch (e) {
    // Constraint unik menangani nomor kembar, termasuk saat dua request bersamaan.
    if (e instanceof VersionNumberTakenError) return { galat: GALAT_NOMOR_TERPAKAI, nilai: hasil.nilai };
    if (e instanceof RegulationNotFoundError) return { pesan: PESAN_REGULASI_TIDAK_ADA };
    console.error("simpanVersi gagal:", e);
    return { pesan: "Versi gagal disimpan. Coba lagi.", nilai: hasil.nilai };
  }

  // redirect() melempar, jadi sengaja di luar try.
  revalidatePath("/", "layout");
  redirect(`/admin/regulasi/${target.regulasi.slug}/versi`);
}

export async function ubahVersi(
  regulationId: string,
  versionId: string,
  _sebelumnya: StatusForm,
  formData: FormData,
): Promise<StatusForm> {
  await wajibAdmin();

  const target = await cariTarget(regulationId, versionId);
  if (!target.regulasi || !target.versi) return { pesan: target.pesan };
  // Pra-cek untuk pesan cepat; penjaga sebenarnya adalah where status DRAF.
  if (!versiBolehDiubah(target.versi.status)) return { pesan: pesanTolakUbahVersi(target.versi.status) };

  const hasil = periksaMasukan(formData);
  if (!hasil.ok) return hasil.status;

  try {
    await updateDraftVersion(regulationId, versionId, hasil.masukan);
  } catch (e) {
    if (e instanceof VersionNumberTakenError) return { galat: GALAT_NOMOR_TERPAKAI, nilai: hasil.nilai };
    if (e instanceof VersionNotEditableError) {
      return { pesan: await pesanSetelahGagal(regulationId, versionId, pesanTolakUbahVersi) };
    }
    console.error("ubahVersi gagal:", e);
    return { pesan: "Versi gagal disimpan. Coba lagi.", nilai: hasil.nilai };
  }

  revalidatePath("/", "layout");
  redirect(`/admin/regulasi/${target.regulasi.slug}/versi`);
}

// Dipakai lewat useActionState; status sebelumnya dan FormData tidak dibutuhkan.
export async function hapusVersi(regulationId: string, versionId: string): Promise<StatusForm> {
  await wajibAdmin();

  const target = await cariTarget(regulationId, versionId);
  if (!target.regulasi || !target.versi) return { pesan: target.pesan };
  if (!versiBolehDihapus(target.versi.status)) return { pesan: pesanTolakHapusVersi(target.versi.status) };

  try {
    await deleteDraftVersion(regulationId, versionId);
  } catch (e) {
    if (e instanceof VersionNotEditableError) {
      return { pesan: await pesanSetelahGagal(regulationId, versionId, pesanTolakHapusVersi) };
    }
    console.error("hapusVersi gagal:", e);
    return { pesan: "Versi gagal dihapus. Coba lagi." };
  }

  revalidatePath("/", "layout");
  redirect(`/admin/regulasi/${target.regulasi.slug}/versi`);
}
