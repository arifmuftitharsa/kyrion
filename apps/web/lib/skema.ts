import { z } from "zod";
import { KATEGORI } from "@/lib/types";

// Dipakai untuk tambah dan ubah regulasi (field yang bisa diisi sama).
export const skemaRegulasi = z.object({
  name: z.string({ error: "Nama regulasi wajib diisi" }).trim()
    .min(5, "Nama regulasi minimal 5 karakter")
    .max(120, "Nama regulasi maksimal 120 karakter"),
  category: z.enum(KATEGORI, { error: "Pilih salah satu kategori" }),
  // Opsional: textarea kosong dikirim sebagai "" lalu disimpan null.
  description: z.string().trim()
    .max(300, "Deskripsi maksimal 300 karakter")
    .optional()
    .transform((nilai) => (nilai ? nilai : null)),
});

export type MasukanRegulasi = z.infer<typeof skemaRegulasi>;

// ID dari argumen terikat (.bind) bisa dimanipulasi klien, jadi tetap divalidasi.
export const skemaIdRegulasi = z.uuid({ error: "ID regulasi tidak valid" });

// Dipakai halaman /masuk di Bagian 4 (sama dengan modul)
export const skemaMasuk = z.object({
  email: z.email("Format email tidak valid"),
  kataSandi: z.string().min(8, "Kata sandi minimal 8 karakter"),
});