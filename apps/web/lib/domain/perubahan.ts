// Aturan domain Change (F-04): fungsi murni dan galat domain, tanpa akses data.
// Change mengikuti status versi induknya (PRD 5.1, N-07): hanya versi DRAF yang
// boleh diubah isinya, jadi aturan boleh-tidaknya memakai versiBolehDiubah.
// Import relatif: Vitest berjalan tanpa config alias "@/".
import { VERSION_STATUS_LABEL, type VersionStatus } from "../types";

export function pesanTolakUbahPerubahan(status: VersionStatus): string {
  return `Perubahan pada versi berstatus ${VERSION_STATUS_LABEL[status]} tidak dapat diubah. Hanya perubahan pada versi Draf yang dapat diubah.`;
}

export function pesanTolakHapusPerubahan(status: VersionStatus): string {
  return `Perubahan pada versi berstatus ${VERSION_STATUS_LABEL[status]} tidak dapat dihapus. Hanya perubahan pada versi Draf yang dapat dihapus.`;
}

/** Change tidak ada pada versi tersebut (sudah dihapus atau milik versi lain). */
export class ChangeNotFoundError extends Error {}
