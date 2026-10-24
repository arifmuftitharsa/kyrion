// Aturan domain regulasi: fungsi murni dan galat domain, tanpa akses data.
// lib/data menerjemahkan galat basis data ke kelas di bawah ini, sehingga
// Server Action tidak bergantung pada tipe Prisma.

/** Hanya regulasi tanpa versi (status apa pun) yang boleh dihapus. */
export function regulasiBolehDihapus(jumlahVersi: number): boolean {
  return jumlahVersi === 0;
}

/** Pesan penolakan hapus yang sama untuk pra-cek dan galat basis data. */
export function pesanTolakHapus(jumlahVersi: number): string {
  return `Regulasi ini memiliki ${jumlahVersi} versi dan tidak dapat dihapus. Hanya regulasi tanpa versi yang dapat dihapus.`;
}

/** Slug sudah dipakai regulasi lain (pelanggaran unik). */
export class SlugTakenError extends Error {}

/** Regulasi masih punya versi (pelanggaran foreign key Restrict). */
export class RegulationHasVersionsError extends Error {}

/** Regulasi yang dituju tidak ada (mis. sudah dihapus). */
export class RegulationNotFoundError extends Error {}
