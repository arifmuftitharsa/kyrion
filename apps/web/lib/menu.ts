// Pemilihan menu header menurut peran. Murni; hanya tampilan, bukan otorisasi.
import type { Tautan } from "@/components/TautanNav";

const umum: Tautan[] = [
  { href: "/", label: "Daftar Regulasi" },
  { href: "/verifikasi", label: "Verifikasi Dokumen" },
];

export function pilihMenu(peran: "ADMIN" | "SIVITAS" | null): { tautan: Tautan[]; bisaKeluar: boolean } {
  if (peran === "ADMIN") {
    return { tautan: [...umum, { href: "/admin/regulasi", label: "Kelola Regulasi" }], bisaKeluar: true };
  }
  if (peran === "SIVITAS") return { tautan: umum, bisaKeluar: true };
  return { tautan: [...umum, { href: "/masuk", label: "Masuk" }], bisaKeluar: false };
}
