import { z } from "zod";
import { KATEGORI } from "@/lib/types";

export const skemaRegulasi = z.object({
  name: z.string().trim()
    .min(5, "Nama regulasi minimal 5 karakter")
    .max(120, "Nama regulasi maksimal 120 karakter"),
  category: z.enum(KATEGORI, { error: "Pilih salah satu kategori" }),
  description: z.string().trim()
    .min(10, "Deskripsi minimal 10 karakter")
    .max(300, "Deskripsi maksimal 300 karakter"),
});

export type MasukanRegulasi = z.infer<typeof skemaRegulasi>;

// Dipakai halaman /masuk di Bagian 4 (sama dengan modul)
export const skemaMasuk = z.object({
  email: z.email("Format email tidak valid"),
  kataSandi: z.string().min(8, "Kata sandi minimal 8 karakter"),
});