import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FormVersi from "@/components/FormVersi";
import { simpanVersi } from "@/app/admin/regulasi/[slug]/versi/actions";
import { getAdminRegulationBySlug } from "@/lib/data/regulations";
import { wajibAdmin } from "@/lib/sesi";

export const metadata: Metadata = { title: "Tambah Versi | Kyrion" };

interface HalamanTambahVersiProps {
  params: Promise<{ slug: string }>;
}

export default async function HalamanTambahVersi({ params }: HalamanTambahVersiProps) {
  await wajibAdmin();
  const { slug } = await params;
  const regulation = await getAdminRegulationBySlug(slug);
  if (!regulation) notFound();

  return (
    <div className="mx-auto max-w-2xl p-4">
      <Link href={`/admin/regulasi/${regulation.slug}/versi`} className="text-sm underline">
        ← Kembali ke Versi {regulation.name}
      </Link>
      <h1 className="mt-2 text-3xl font-bold">Tambah Versi</h1>
      <p className="mt-2 text-sm text-gray-600">
        {regulation.name}. Versi baru selalu berstatus Draf. Unggah dokumen PDF belum
        tersedia di v0.2.
      </p>
      <FormVersi aksi={simpanVersi.bind(null, regulation.id)} labelTombol="Simpan" />
    </div>
  );
}
