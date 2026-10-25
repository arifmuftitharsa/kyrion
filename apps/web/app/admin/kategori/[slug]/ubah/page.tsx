import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FormKategori from "@/components/FormKategori";
import { gantiNamaKategori } from "@/app/admin/kategori/actions";
import { getAdminCategoryBySlug } from "@/lib/data/categories";
import { wajibAdmin } from "@/lib/sesi";

export const metadata: Metadata = { title: "Ganti Nama Kategori | Kyrion" };

interface HalamanGantiNamaKategoriProps {
  params: Promise<{ slug: string }>;
}

export default async function HalamanGantiNamaKategori({ params }: HalamanGantiNamaKategoriProps) {
  await wajibAdmin();
  const { slug } = await params;
  const category = await getAdminCategoryBySlug(slug);
  if (!category) notFound();

  return (
    <div className="mx-auto max-w-2xl p-4">
      <Link href="/admin/kategori" className="text-sm underline">
        ← Kembali ke Kelola Kategori
      </Link>
      <h1 className="mt-2 text-3xl font-bold">Ganti Nama Kategori</h1>
      <p className="mt-2 text-sm text-gray-600">
        Slug kategori ikut berubah; tautan filter lama di beranda tidak lagi memfilter.
        Slug regulasi tidak berubah.
      </p>
      <FormKategori
        aksi={gantiNamaKategori.bind(null, category.id)}
        nilaiAwal={{ name: category.name }}
        labelTombol="Simpan perubahan"
      />
    </div>
  );
}
