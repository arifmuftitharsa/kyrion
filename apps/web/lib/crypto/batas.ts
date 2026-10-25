// Konstanta tanpa impor apa pun, sehingga aman dibundel ke browser. Dipisah dari
// fingerprint.ts karena modul itu mengimpor node:crypto (hanya untuk server),
// sedangkan FormVersi (Client Component) perlu batas yang sama dengan server.

// Batas sama dengan batas unggah formulir (10 MB). Membatasi input mencegah
// server menghabiskan memori/CPU untuk berkas yang tidak wajar besarnya.
export const MAX_INPUT_BYTES = 10 * 1024 * 1024;
