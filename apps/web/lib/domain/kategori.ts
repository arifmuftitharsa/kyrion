// Aturan domain kategori (PRD F-10): fungsi murni dan galat domain, tanpa akses
// data. Nama mirip (beda huruf besar-kecil/spasi) ditolak lewat slug yang sama:
// slug selalu createSlug(nama) dan unik di basis data.

/** Hanya kategori tanpa regulasi yang boleh dihapus. */
export function kategoriBolehDihapus(jumlahRegulasi: number): boolean {
  return jumlahRegulasi === 0;
}

/** Pesan penolakan hapus yang sama untuk pra-cek dan galat basis data. */
export function pesanTolakHapusKategori(jumlahRegulasi: number): string {
  return `Kategori ini dipakai ${jumlahRegulasi} regulasi dan tidak dapat dihapus. Hanya kategori tanpa regulasi yang dapat dihapus.`;
}

/** Slug (nama mirip) sudah dipakai kategori lain. */
export class CategorySlugTakenError extends Error {}

/** Kategori masih dipakai regulasi (pelanggaran foreign key Restrict). */
export class CategoryHasRegulationsError extends Error {}

/** Kategori yang dituju tidak ada (mis. sudah dihapus). */
export class CategoryNotFoundError extends Error {}
