// Aturan domain pengelolaan versi oleh admin (PRD 5.1, F-12): fungsi murni
// dan galat domain, tanpa akses data. lib/data menerjemahkan galat basis data
// ke kelas di bawah ini, sehingga Server Action tidak bergantung pada Prisma.
// Import relatif: Vitest berjalan tanpa config alias "@/".
import { VERSION_STATUS_LABEL, type VersionStatus } from "../types";

/** Hanya versi DRAF yang boleh diubah. */
export function versiBolehDiubah(status: VersionStatus): boolean {
  return status === "DRAF";
}

/** Hanya versi DRAF yang boleh dihapus; DIBATALKAN disimpan sebagai jejak. */
export function versiBolehDihapus(status: VersionStatus): boolean {
  return status === "DRAF";
}

export function pesanTolakUbahVersi(status: VersionStatus): string {
  return `Versi berstatus ${VERSION_STATUS_LABEL[status]} tidak dapat diubah. Hanya versi Draf yang dapat diubah.`;
}

export function pesanTolakHapusVersi(status: VersionStatus): string {
  return `Versi berstatus ${VERSION_STATUS_LABEL[status]} tidak dapat dihapus. Hanya versi Draf yang dapat dihapus.`;
}

/** Hanya versi DRAF yang boleh dibatalkan. */
export function versiBolehDibatalkan(status: VersionStatus): boolean {
  return status === "DRAF";
}

export type AlasanTolakSahkan = "BUKAN_DRAF" | "TANPA_BERKAS" | "TANGGAL_KEMBAR";

export interface BahanSahkan {
  status: VersionStatus;
  berkasLengkap: boolean;
  /** Ada versi lain yang pernah disahkan (SAH/DIGANTIKAN) dengan tanggal berlaku sama. */
  tanggalKembar: boolean;
}

/** Alasan pertama yang menolak pengesahan; undefined bila boleh disahkan. */
export function alasanTolakSahkan(b: BahanSahkan): AlasanTolakSahkan | undefined {
  if (b.status !== "DRAF") return "BUKAN_DRAF";
  if (!b.berkasLengkap) return "TANPA_BERKAS";
  if (b.tanggalKembar) return "TANGGAL_KEMBAR";
  return undefined;
}

export function versiBolehDisahkan(b: BahanSahkan): boolean {
  return alasanTolakSahkan(b) === undefined;
}

export const PESAN_TANPA_BERKAS =
  "Versi belum punya berkas PDF lengkap. Unggah berkas lewat Ubah sebelum mengesahkan.";
export const PESAN_TANGGAL_KEMBAR =
  "Sudah ada versi lain yang disahkan dengan tanggal berlaku yang sama. Ubah tanggal berlaku versi ini.";

export function pesanTolakSahkan(alasan: AlasanTolakSahkan, status: VersionStatus): string {
  switch (alasan) {
    case "BUKAN_DRAF":
      return `Versi berstatus ${VERSION_STATUS_LABEL[status]} tidak dapat disahkan. Hanya versi Draf yang dapat disahkan.`;
    case "TANPA_BERKAS":
      return PESAN_TANPA_BERKAS;
    case "TANGGAL_KEMBAR":
      return PESAN_TANGGAL_KEMBAR;
  }
}

export function pesanTolakBatalkanVersi(status: VersionStatus): string {
  return `Versi berstatus ${VERSION_STATUS_LABEL[status]} tidak dapat dibatalkan. Hanya versi Draf yang dapat dibatalkan.`;
}

/** Versi tidak punya berkas lengkap saat disahkan. */
export class VersionWithoutFileError extends Error {}

/** Tanggal berlaku sama dengan versi lain yang pernah disahkan pada regulasi yang sama. */
export class VersionEffectiveDateTakenError extends Error {}

/** Nomor versi sudah dipakai pada regulasi yang sama (pelanggaran unik). */
export class VersionNumberTakenError extends Error {}

/** Mutasi bersyarat tidak mengenai baris: status bukan DRAF lagi atau versi hilang. */
export class VersionNotEditableError extends Error {}
