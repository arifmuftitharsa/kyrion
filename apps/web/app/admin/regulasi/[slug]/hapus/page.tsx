import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FormHapusRegulasi from "@/components/FormHapusRegulasi";
import { hapusRegulasi } from "@/app/admin/regulasi/actions";
import { getAdminRegulationBySlug } from "@/lib/data/regulations";
import { wajibAdmin } from "@/lib/sesi";

export const metadata: Metadata = { title: "Hapus Regulasi | Kyrion" };

interface HalamanHapusRegulasiProps {
  params: Promise<{ slug: string }>;
}

export default async function HalamanHapusRegulasi({ params }: HalamanHapusRegulasiProps) {
  await wajibAdmin();
  const { slug } = await params;
  const regulation = await getAdminRegulationBySlug(slug);
  if (!regulation) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <Link href="/admin/regulasi" className="text-sm underline">
        ← Kembali ke Kelola Regulasi
      </Link>
      <h1 className="text-3xl font-bold">Hapus Regulasi</h1>
      <p>
        Anda akan menghapus <strong>{regulation.name}</strong> secara permanen.
        Regulasi ini memiliki {regulation.versionCount} versi; hanya regulasi
        tanpa versi yang dapat dihapus.
      </p>
      <FormHapusRegulasi
        aksi={hapusRegulasi.bind(null, regulation.id)}
        namaRegulasi={regulation.name}
      />
      <Link href="/admin/regulasi" className="inline-block underline">
        Batal
      </Link>
    </div>
  );
}
