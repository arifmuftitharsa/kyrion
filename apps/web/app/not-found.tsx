import type { Metadata } from "next";
import Link from "next/link";
import { focusRing } from "@/lib/styles";

// Root layout tidak memakai title.template, jadi judul ditulis lengkap.
export const metadata: Metadata = { title: "Halaman tidak ditemukan | Kyrion" };

export default function NotFound() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-slate-900">
        Halaman tidak ditemukan
      </h1>
      <p className="max-w-3xl text-slate-700">
        Alamat yang kamu buka tidak ada di Kyrion. Periksa kembali alamatnya
        atau kembali ke daftar regulasi.
      </p>
      <Link
        href="/"
        className={`inline-block rounded font-medium text-blue-800 underline underline-offset-4 hover:text-blue-900 ${focusRing}`}
      >
        <span aria-hidden="true">← </span>Kembali ke Daftar Regulasi
      </Link>
    </div>
  );
}