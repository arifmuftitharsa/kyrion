import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FormHapus from "@/components/FormHapus";
import { hapusKategori } from "@/app/admin/kategori/actions";
import { getAdminCategoryBySlug } from "@/lib/data/categories";
import { kategoriBolehDihapus, pesanTolakHapusKategori } from "@/lib/domain/kategori";
import { wajibAdmin } from "@/lib/sesi";

export const metadata: Metadata = { title: "Hapus Kategori | Kyrion" };

interface HalamanHapusKategoriProps {
  params: Promise<{ slug: string }>;
}

export default async function HalamanHapusKategori({ params }: HalamanHapusKategoriProps) {
  await wajibAdmin();
  const { slug } = await params;
  const category = await getAdminCategoryBySlug(slug);
  if (!category) notFound();

  const bolehDihapus = kategoriBolehDihapus(category.regulationCount);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <Link href="/admin/kategori" className="text-sm underline">
        ← Kembali ke Kelola Kategori
      </Link>
      <h1 className="text-3xl font-bold">Hapus Kategori</h1>
      {bolehDihapus ? (
        <>
          <p>
            Anda akan menghapus kategori <strong>{category.name}</strong> secara permanen.
          </p>
          <FormHapus
            aksi={hapusKategori.bind(null, category.id)}
            labelTombol={`Hapus kategori ${category.name}`}
          />
        </>
      ) : (
        // Tanpa form; server juga menolak bila action dipanggil langsung.
        <p role="status" className="font-medium text-red-800">
          {pesanTolakHapusKategori(category.regulationCount)}
        </p>
      )}
      <Link href="/admin/kategori" className="inline-block underline">
        {bolehDihapus ? "Batal" : "Kembali"}
      </Link>
    </div>
  );
}
