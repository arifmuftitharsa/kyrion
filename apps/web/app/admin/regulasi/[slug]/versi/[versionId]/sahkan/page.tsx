import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FormKonfirmasi from "@/components/FormKonfirmasi";
import { sahkanVersi } from "@/app/admin/regulasi/[slug]/versi/actions";
import { getAdminRegulationBySlug } from "@/lib/data/regulations";
import { findVersion, getAdminVersions, getPenandaVersi } from "@/lib/data/versions";
import { PERNAH_DISAHKAN } from "@/lib/domain/versi";
import { alasanTolakSahkan, pesanTolakSahkan } from "@/lib/domain/versi-admin";
import { formatDate } from "@/lib/format";
import { skemaIdVersi } from "@/lib/skema";
import { wajibAdmin } from "@/lib/sesi";

export const metadata: Metadata = { title: "Sahkan Versi | Kyrion" };

interface HalamanSahkanVersiProps {
  params: Promise<{ slug: string; versionId: string }>;
}

export default async function HalamanSahkanVersi({ params }: HalamanSahkanVersiProps) {
  await wajibAdmin();
  const { slug, versionId } = await params;
  const regulation = await getAdminRegulationBySlug(slug);
  if (!regulation || !skemaIdVersi.safeParse(versionId).success) notFound();
  // Penanda dibaca SEBELUM versi: bila versi diedit di antaranya, penanda basi dan pengesahan gagal aman.
  const penanda = await getPenandaVersi(regulation.id, versionId);
  const version = await findVersion(regulation.id, versionId);
  if (!penanda || !version) notFound();

  const saudara = await getAdminVersions(regulation.id);
  const alasan = alasanTolakSahkan({
    status: version.status,
    berkasLengkap: Boolean(version.fileKey && version.fileName && version.fileSize !== null),
    tanggalKembar: saudara.some(
      (v) =>
        v.id !== version.id &&
        PERNAH_DISAHKAN.includes(v.status) &&
        v.effectiveDate === version.effectiveDate,
    ),
  });
  const kembali = `/admin/regulasi/${regulation.slug}/versi`;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <Link href={kembali} className="text-sm underline">
        ← Kembali ke Versi {regulation.name}
      </Link>
      <h1 className="text-3xl font-bold">Sahkan Versi {version.versionNumber}</h1>
      {alasan === undefined ? (
        <>
          <p>
            Anda akan mengesahkan versi <strong>{version.versionNumber}</strong> dari{" "}
            {regulation.name}, mulai berlaku{" "}
            <time dateTime={version.effectiveDate}>{formatDate(version.effectiveDate)}</time>,
            dengan berkas <strong>{version.fileName}</strong>.
          </p>
          <p className="font-medium">
            Pengesahan tidak dapat dibatalkan, dan versi yang sudah sah tidak dapat diubah atau dihapus.
          </p>
          <FormKonfirmasi
            aksi={sahkanVersi.bind(null, regulation.id, version.id, penanda)}
            labelTombol={`Sahkan versi ${version.versionNumber}`}
            labelProses="Mengesahkan..."
            varian="utama"
          />
        </>
      ) : (
        // Tanpa form; server juga menolak bila action dipanggil langsung.
        <p role="status" className="font-medium text-red-800">
          {pesanTolakSahkan(alasan, version.status)}
        </p>
      )}
      <Link href={kembali} className="inline-block underline">
        {alasan === undefined ? "Batal" : "Kembali"}
      </Link>
    </div>
  );
}
