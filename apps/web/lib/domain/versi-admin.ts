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

/** Nomor versi sudah dipakai pada regulasi yang sama (pelanggaran unik). */
export class VersionNumberTakenError extends Error {}

/** Mutasi bersyarat tidak mengenai baris: status bukan DRAF lagi atau versi hilang. */
export class VersionNotEditableError extends Error {}
