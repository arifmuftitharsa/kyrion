import type { Metadata } from "next";
import Link from "next/link";
import FormRegulasi from "@/components/FormRegulasi";
import { getCategoryOptions } from "@/lib/data/categories";
import { wajibAdmin } from "@/lib/sesi";
import { simpanRegulasi } from "@/app/admin/regulasi/actions";

export const metadata: Metadata = { title: "Tambah Regulasi | Kyrion" };

export default async function HalamanTambahRegulasi() {
  await wajibAdmin();
  const kategori = await getCategoryOptions();

  return (
    <div className="mx-auto max-w-2xl p-4">
      <Link href="/admin/regulasi" className="text-sm underline">
        ← Kembali ke Kelola Regulasi
      </Link>
      <h1 className="mt-2 text-3xl font-bold">Tambah Regulasi</h1>
      <FormRegulasi aksi={simpanRegulasi} kategori={kategori} labelTombol="Simpan" />
    </div>
  );
}
