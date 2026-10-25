import { z } from "zod";
import { susunTanggalIso } from "@/lib/domain/tanggal";

// Dipakai untuk tambah dan ubah regulasi (field yang bisa diisi sama).
// Keberadaan kategori dicek terpisah di Server Action (butuh data tersimpan).
export const skemaRegulasi = z.object({
  name: z.string({ error: "Nama regulasi wajib diisi" }).trim()
    .min(5, "Nama regulasi minimal 5 karakter")
    .max(120, "Nama regulasi maksimal 120 karakter"),
  categoryId: z.uuid({ error: "Pilih salah satu kategori" }),
  // Opsional: textarea kosong dikirim sebagai "" lalu disimpan null.
  description: z.string().trim()
    .max(300, "Deskripsi maksimal 300 karakter")
    .optional()
    .transform((nilai) => (nilai ? nilai : null)),
});

export type MasukanRegulasi = z.infer<typeof skemaRegulasi>;

// ID dari argumen terikat (.bind) bisa dimanipulasi klien, jadi tetap divalidasi.
export const skemaIdRegulasi = z.uuid({ error: "ID regulasi tidak valid" });

// Dipakai untuk tambah dan ganti nama kategori (PRD F-10).
export const skemaKategori = z.object({
  name: z.string({ error: "Nama kategori wajib diisi" }).trim()
    .min(3, "Nama kategori minimal 3 karakter")
    .max(50, "Nama kategori maksimal 50 karakter"),
});

export const skemaIdKategori = z.uuid({ error: "ID kategori tidak valid" });

const PESAN_HARI = "Tanggal harus angka 1 sampai 31";
const PESAN_BULAN = "Pilih bulan";
const PESAN_TAHUN = "Tahun harus antara 2000 dan 2100";
const PESAN_TANGGAL = "Tanggal mulai berlaku tidak valid";

/** Angka bulat dari FormData dalam rentang [min, max]; "" dan teks non-angka ditolak. */
const angkaDalamRentang = (min: number, max: number, pesan: string) =>
  z.coerce.number({ error: pesan }).int(pesan).min(min, pesan).max(max, pesan);

// Dipakai untuk tambah dan ubah versi. Status sengaja tidak ada: server selalu
// menulis DRAF saat tambah dan tidak pernah mengubah status saat ubah.
// Tanggal datang sebagai tiga kolom (hari, bulan, tahun) agar tidak ambigu
// terhadap urutan bahasa browser, lalu disusun menjadi effectiveDate ISO.
export const skemaVersi = z
  .object({
    versionNumber: z.string({ error: "Nomor versi wajib diisi" }).trim()
      .min(1, "Nomor versi wajib diisi")
      .max(30, "Nomor versi maksimal 30 karakter"),
    effectiveDay: angkaDalamRentang(1, 31, PESAN_HARI),
    effectiveMonth: angkaDalamRentang(1, 12, PESAN_BULAN),
    effectiveYear: angkaDalamRentang(2000, 2100, PESAN_TAHUN),
    changeSummary: z.string().trim()
      .max(500, "Ringkasan perubahan maksimal 500 karakter")
      .optional()
      .transform((nilai) => (nilai ? nilai : null)),
  })
  .transform(({ effectiveDay, effectiveMonth, effectiveYear, ...sisa }, ctx) => {
    const effectiveDate = susunTanggalIso(effectiveDay, effectiveMonth, effectiveYear);
    // z.iso.date() menolak tanggal mustahil seperti 31 Juni atau 29 Februari 2027.
    if (!z.iso.date().safeParse(effectiveDate).success) {
      ctx.issues.push({ code: "custom", message: PESAN_TANGGAL, input: effectiveDate, path: ["effectiveDate"] });
      return z.NEVER;
    }
    return { ...sisa, effectiveDate };
  });

export type MasukanVersi = z.infer<typeof skemaVersi>;

export const skemaIdVersi = z.uuid({ error: "ID versi tidak valid" });

// Dipakai halaman /masuk di Bagian 4 (sama dengan modul)
export const skemaMasuk = z.object({
  // Dinormalisasi huruf kecil agar cocok dengan email tersimpan di tabel users.
  email: z.string().trim().toLowerCase().pipe(z.email("Format email tidak valid")),
  // Batas atas membatasi ukuran masukan yang diproses scrypt.
  kataSandi: z.string()
    .min(8, "Kata sandi minimal 8 karakter")
    .max(256, "Kata sandi maksimal 256 karakter"),
});