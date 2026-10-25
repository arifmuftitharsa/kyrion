import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FormPerubahan from "@/components/FormPerubahan";
import { simpanPerubahan } from "@/app/admin/regulasi/[slug]/versi/[versionId]/perubahan/actions";
import { getAdminRegulationBySlug } from "@/lib/data/regulations";
import { findVersion } from "@/lib/data/versions";
import { pesanTolakUbahPerubahan } from "@/lib/domain/perubahan";
import { versiBolehDiubah } from "@/lib/domain/versi-admin";
import { skemaIdVersi } from "@/lib/skema";
import { wajibAdmin } from "@/lib/sesi";

export const metadata: Metadata = { title: "Tambah Perubahan | Kyrion" };

interface HalamanTambahPerubahanProps {
  params: Promise<{ slug: string; versionId: string }>;
}

export default async function HalamanTambahPerubahan({ params }: HalamanTambahPerubahanProps) {
  await wajibAdmin();
  const { slug, versionId } = await params;
  const regulation = await getAdminRegulationBySlug(slug);
  if (!regulation || !skemaIdVersi.safeParse(versionId).success) notFound();
  const version = await findVersion(regulation.id, versionId);
  if (!version) notFound();

  const kembali = `/admin/regulasi/${regulation.slug}/versi/${version.id}/perubahan`;

  return (
    <div className="mx-auto max-w-2xl p-4">
      <Link href={kembali} className="text-sm underline">
        ← Kembali ke Perubahan Versi {version.versionNumber}
      </Link>
      <h1 className="mt-2 text-3xl font-bold">Tambah Perubahan</h1>
      {versiBolehDiubah(version.status) ? (
        <FormPerubahan
          aksi={simpanPerubahan.bind(null, regulation.id, version.id)}
          labelTombol="Simpan perubahan"
        />
      ) : (
        // Tanpa form; server juga menolak bila action dipanggil langsung.
        <p role="status" className="mt-6 font-medium text-red-800">
          {pesanTolakUbahPerubahan(version.status)}
        </p>
      )}
    </div>
  );
}
