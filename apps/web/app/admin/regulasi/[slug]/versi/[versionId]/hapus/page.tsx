import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FormHapus from "@/components/FormHapus";
import { hapusVersi } from "@/app/admin/regulasi/[slug]/versi/actions";
import { getAdminRegulationBySlug } from "@/lib/data/regulations";
import { findVersion } from "@/lib/data/versions";
import { pesanTolakHapusVersi, versiBolehDihapus } from "@/lib/domain/versi-admin";
import { formatDate } from "@/lib/format";
import { skemaIdVersi } from "@/lib/skema";
import { wajibAdmin } from "@/lib/sesi";

export const metadata: Metadata = { title: "Hapus Versi | Kyrion" };

interface HalamanHapusVersiProps {
  params: Promise<{ slug: string; versionId: string }>;
}

export default async function HalamanHapusVersi({ params }: HalamanHapusVersiProps) {
  await wajibAdmin();
  const { slug, versionId } = await params;
  const regulation = await getAdminRegulationBySlug(slug);
  if (!regulation || !skemaIdVersi.safeParse(versionId).success) notFound();
  // Versi hanya ditemukan bila milik regulasi pada URL.
  const version = await findVersion(regulation.id, versionId);
  if (!version) notFound();

  const kembali = `/admin/regulasi/${regulation.slug}/versi`;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <Link href={kembali} className="text-sm underline">
        ← Kembali ke Versi {regulation.name}
      </Link>
      <h1 className="text-3xl font-bold">Hapus Versi {version.versionNumber}</h1>
      {versiBolehDihapus(version.status) ? (
        <>
          <p>
            Anda akan menghapus versi <strong>{version.versionNumber}</strong> dari{" "}
            {regulation.name} (mulai berlaku{" "}
            <time dateTime={version.effectiveDate}>{formatDate(version.effectiveDate)}</time>)
            secara permanen.
          </p>
          <FormHapus
            aksi={hapusVersi.bind(null, regulation.id, version.id)}
            labelTombol={`Hapus versi ${version.versionNumber}`}
          />
        </>
      ) : (
        // Tanpa form; server juga menolak bila action dipanggil langsung.
        <p role="status" className="font-medium text-red-800">
          {pesanTolakHapusVersi(version.status)}
        </p>
      )}
      <Link href={kembali} className="inline-block underline">
        {versiBolehDihapus(version.status) ? "Batal" : "Kembali"}
      </Link>
    </div>
  );
}
