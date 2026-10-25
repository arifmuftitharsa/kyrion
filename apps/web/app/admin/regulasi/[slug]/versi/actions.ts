"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fingerprint } from "@/lib/crypto/fingerprint";
import { getAdminRegulationById, type AdminRegulation } from "@/lib/data/regulations";
import {
  createVersion,
  deleteDraftVersion,
  findVersion,
  updateDraftVersion,
  type AdminVersion,
  type DataBerkas,
} from "@/lib/data/versions";
import {
  PDF_MAGIC,
  ambilBerkasOpsional,
  sanitasiNamaBerkas,
  validasiBerkasPdf,
} from "@/lib/domain/berkas-pdf";
import { RegulationNotFoundError } from "@/lib/domain/regulasi";
import {
  VersionNotEditableError,
  VersionNumberTakenError,
  pesanTolakHapusVersi,
  pesanTolakUbahVersi,
  versiBolehDihapus,
  versiBolehDiubah,
} from "@/lib/domain/versi-admin";
import { hapusBerkas, simpanBerkas } from "@/lib/penyimpanan";
import { skemaIdRegulasi, skemaIdVersi, skemaVersi, type MasukanVersi } from "@/lib/skema";
import { wajibAdmin } from "@/lib/sesi";
import type { StatusForm } from "@/lib/status-form";
import type { VersionStatus } from "@/lib/types";

const GALAT_NOMOR_TERPAKAI = { versionNumber: ["Nomor versi ini sudah dipakai pada regulasi ini"] };
const PESAN_REGULASI_TIDAK_ADA = "Regulasi tidak ditemukan atau sudah dihapus.";
const PESAN_VERSI_TIDAK_ADA = "Versi tidak ditemukan atau sudah dihapus.";
const PESAN_BERKAS_BERUBAH =
  "Berkas versi ini baru saja diubah oleh permintaan lain. Muat ulang halaman, lalu coba lagi.";

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
  if (!terbaru) return PESAN_VERSI_TIDAK_ADA;
  // Masih Draf berarti yang berubah adalah berkasnya (diganti permintaan lain).
  if (terbaru.status === "DRAF") return PESAN_BERKAS_BERUBAH;
  return pesanTolak(terbaru.status);
}

type Unggahan =
  | { tipe: "tidak-ada" }
  | { tipe: "galat"; pesan: string }
  | { tipe: "ada"; bytes: Uint8Array; nama: string; sha256: string };

/**
 * Membaca dan memvalidasi berkas PDF dari form (opsional). Ukuran dan magic bytes
 * dicek sebelum seluruh isi dibaca ke memori; hash dihitung dengan fungsi F-30.
 */
async function bacaUnggahan(formData: FormData): Promise<Unggahan> {
  const entri = ambilBerkasOpsional(formData.get("berkas"));
  if (!entri) return { tipe: "tidak-ada" };
  const awal = new Uint8Array(await entri.slice(0, PDF_MAGIC.length).arrayBuffer());
  const pesan = validasiBerkasPdf({ size: entri.size, awal });
  if (pesan) return { tipe: "galat", pesan };
  const bytes = new Uint8Array(await entri.arrayBuffer());
  return { tipe: "ada", bytes, nama: sanitasiNamaBerkas(entri.name), sha256: fingerprint(bytes) };
}

/** Menulis berkas ke disk dengan nama buatan server. */
async function simpanUnggahan(unggahan: Extract<Unggahan, { tipe: "ada" }>): Promise<DataBerkas> {
  const key = await simpanBerkas(unggahan.bytes);
  return { key, name: unggahan.nama, size: unggahan.bytes.length, sha256: unggahan.sha256 };
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

  const unggahan = await bacaUnggahan(formData);
  if (unggahan.tipe === "galat") {
    return { galat: { berkas: [unggahan.pesan] }, nilai: hasil.nilai };
  }

  // Berkas ditulis ke disk lebih dulu, lalu satu insert; bila DB gagal, berkas dihapus lagi.
  let berkas: DataBerkas | undefined;
  try {
    if (unggahan.tipe === "ada") berkas = await simpanUnggahan(unggahan);
    await createVersion(regulationId, hasil.masukan, berkas);
  } catch (e) {
    if (berkas) await hapusBerkas(berkas.key);
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

  const unggahan = await bacaUnggahan(formData);
  if (unggahan.tipe === "galat") {
    return { galat: { berkas: [unggahan.pesan] }, nilai: hasil.nilai };
  }

  // Berkas baru ditulis dulu; DB hanya berubah bila berkas lama masih keyLama.
  // Berkas lama baru dihapus setelah DB sukses, jadi tidak pernah ada baris yang menunjuk berkas hilang.
  const keyLama = target.versi.fileKey;
  let berkasBaru: DataBerkas | undefined;
  try {
    if (unggahan.tipe === "ada") berkasBaru = await simpanUnggahan(unggahan);
    await updateDraftVersion(
      regulationId,
      versionId,
      hasil.masukan,
      berkasBaru && { baru: berkasBaru, keyLama },
    );
  } catch (e) {
    if (berkasBaru) await hapusBerkas(berkasBaru.key);
    if (e instanceof VersionNumberTakenError) return { galat: GALAT_NOMOR_TERPAKAI, nilai: hasil.nilai };
    if (e instanceof VersionNotEditableError) {
      return { pesan: await pesanSetelahGagal(regulationId, versionId, pesanTolakUbahVersi) };
    }
    console.error("ubahVersi gagal:", e);
    return { pesan: "Versi gagal disimpan. Coba lagi.", nilai: hasil.nilai };
  }
  if (berkasBaru && keyLama) await hapusBerkas(keyLama);

  revalidatePath("/", "layout");
  redirect(`/admin/regulasi/${target.regulasi.slug}/versi`);
}

// Dipakai lewat useActionState; status sebelumnya dan FormData tidak dibutuhkan.
export async function hapusVersi(regulationId: string, versionId: string): Promise<StatusForm> {
  await wajibAdmin();

  const target = await cariTarget(regulationId, versionId);
  if (!target.regulasi || !target.versi) return { pesan: target.pesan };
  if (!versiBolehDihapus(target.versi.status)) return { pesan: pesanTolakHapusVersi(target.versi.status) };

  // Baris DB dihapus lebih dulu (hanya bila berkasnya masih sama), baru berkas di disk.
  const fileKey = target.versi.fileKey;
  try {
    await deleteDraftVersion(regulationId, versionId, fileKey);
  } catch (e) {
    if (e instanceof VersionNotEditableError) {
      return { pesan: await pesanSetelahGagal(regulationId, versionId, pesanTolakHapusVersi) };
    }
    console.error("hapusVersi gagal:", e);
    return { pesan: "Versi gagal dihapus. Coba lagi." };
  }
  if (fileKey) await hapusBerkas(fileKey);

  revalidatePath("/", "layout");
  redirect(`/admin/regulasi/${target.regulasi.slug}/versi`);
}
