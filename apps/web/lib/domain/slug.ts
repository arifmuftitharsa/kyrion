/** Ubah nama menjadi slug URL: huruf kecil, tanpa aksen, selain huruf/angka jadi "-". */
export function createSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
