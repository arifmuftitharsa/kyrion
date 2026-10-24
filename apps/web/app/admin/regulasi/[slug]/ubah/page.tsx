import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FormRegulasi from "@/components/FormRegulasi";
import { ubahRegulasi } from "@/app/admin/regulasi/actions";
import { getAdminRegulationBySlug } from "@/lib/data/regulations";
import { wajibAdmin } from "@/lib/sesi";

export const metadata: Metadata = { title: "Ubah Regulasi | Kyrion" };

interface HalamanUbahRegulasiProps {
  params: Promise<{ slug: string }>;
}

export default async function HalamanUbahRegulasi({ params }: HalamanUbahRegulasiProps) {
  await wajibAdmin();
  const { slug } = await params;
  const regulation = await getAdminRegulationBySlug(slug);
  if (!regulation) notFound();

  return (
    <div className="mx-auto max-w-2xl p-4">
      <Link href="/admin/regulasi" className="text-sm underline">
        ← Kembali ke Kelola Regulasi
      </Link>
      <h1 className="mt-2 text-3xl font-bold">Ubah Regulasi</h1>
      <p className="mt-2 text-sm text-gray-600">
        Slug URL ikut berubah bila nama diubah; tautan lama tidak lagi berlaku.
      </p>
      <FormRegulasi
        aksi={ubahRegulasi.bind(null, regulation.id)}
        nilaiAwal={{
          name: regulation.name,
          category: regulation.category,
          description: regulation.description ?? "",
        }}
        labelTombol="Simpan perubahan"
      />
    </div>
  );
}
