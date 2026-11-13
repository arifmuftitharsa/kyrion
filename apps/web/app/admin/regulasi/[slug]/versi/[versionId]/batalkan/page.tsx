import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FormKonfirmasi from "@/components/FormKonfirmasi";
import { batalkanVersi } from "@/app/admin/regulasi/[slug]/versi/actions";
import { getAdminRegulationBySlug } from "@/lib/data/regulations";
import { findVersion } from "@/lib/data/versions";
import { pesanTolakBatalkanVersi, versiBolehDibatalkan } from "@/lib/domain/versi-admin";
import { formatDate } from "@/lib/format";
import { skemaIdVersi } from "@/lib/skema";
import { wajibAdmin } from "@/lib/sesi";

export const metadata: Metadata = { title: "Batalkan Versi | Kyrion" };

interface HalamanBatalkanVersiProps {
  params: Promise<{ slug: string; versionId: string }>;
}

export default async function HalamanBatalkanVersi({ params }: HalamanBatalkanVersiProps) {
  await wajibAdmin();
  const { slug, versionId } = await params;
  const regulation = await getAdminRegulationBySlug(slug);
  if (!regulation || !skemaIdVersi.safeParse(versionId).success) notFound();
  // Versi hanya ditemukan bila milik regulasi pada URL.
  const version = await findVersion(regulation.id, versionId);
  if (!version) notFound();

  const kembali = `/admin/regulasi/${regulation.slug}/versi`;
  const boleh = versiBolehDibatalkan(version.status);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <Link href={kembali} className="text-sm underline">
        ← Kembali ke Versi {regulation.name}
      </Link>
      <h1 className="text-3xl font-bold">Batalkan Versi {version.versionNumber}</h1>
      {boleh ? (
        <>
          <p>
            Anda akan membatalkan versi <strong>{version.versionNumber}</strong> dari{" "}
            {regulation.name} (mulai berlaku{" "}
            <time dateTime={version.effectiveDate}>{formatDate(version.effectiveDate)}</time>).
            Versi tetap tersimpan sebagai jejak dengan status Dibatalkan, berkasnya tidak dihapus,
            dan pembatalan tidak dapat diurungkan.
          </p>
          <FormKonfirmasi
            aksi={batalkanVersi.bind(null, regulation.id, version.id)}
            labelTombol={`Batalkan versi ${version.versionNumber}`}
            labelProses="Membatalkan..."
            varian="bahaya"
          />
        </>
      ) : (
        // Tanpa form; server juga menolak bila action dipanggil langsung.
        <p role="status" className="font-medium text-red-800">
          {pesanTolakBatalkanVersi(version.status)}
        </p>
      )}
      <Link href={kembali} className="inline-block underline">
        {boleh ? "Batal" : "Kembali"}
      </Link>
    </div>
  );
}
