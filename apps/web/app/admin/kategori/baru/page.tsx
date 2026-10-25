import type { Metadata } from "next";
import Link from "next/link";
import FormKategori from "@/components/FormKategori";
import { simpanKategori } from "@/app/admin/kategori/actions";
import { wajibAdmin } from "@/lib/sesi";

export const metadata: Metadata = { title: "Tambah Kategori | Kyrion" };

export default async function HalamanTambahKategori() {
  await wajibAdmin();

  return (
    <div className="mx-auto max-w-2xl p-4">
      <Link href="/admin/kategori" className="text-sm underline">
        ← Kembali ke Kelola Kategori
      </Link>
      <h1 className="mt-2 text-3xl font-bold">Tambah Kategori</h1>
      <FormKategori aksi={simpanKategori} labelTombol="Simpan" />
    </div>
  );
}
