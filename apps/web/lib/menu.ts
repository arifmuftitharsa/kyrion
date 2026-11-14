// Pemilihan menu header menurut peran. Murni; hanya tampilan, bukan otorisasi.
import type { Tautan } from "@/components/TautanNav";

const daftar: Tautan = { href: "/", label: "Daftar Regulasi" };

export function pilihMenu(peran: "ADMIN" | "SIVITAS" | null): { tautan: Tautan[]; bisaKeluar: boolean } {
  if (peran === "ADMIN") {
    return {
      tautan: [
        daftar,
        { href: "/admin/regulasi", label: "Kelola Regulasi" },
        { href: "/admin/verifikasi", label: "Periksa Berkas" },
      ],
      bisaKeluar: true,
    };
  }
  if (peran === "SIVITAS") return { tautan: [daftar], bisaKeluar: true };
  return { tautan: [{ href: "/masuk", label: "Masuk" }], bisaKeluar: false };
}
