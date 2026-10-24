import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FormVersi from "@/components/FormVersi";
import { ubahVersi } from "@/app/admin/regulasi/[slug]/versi/actions";
import { getAdminRegulationBySlug } from "@/lib/data/regulations";
import { findVersion } from "@/lib/data/versions";
import { pecahTanggalIso } from "@/lib/domain/tanggal";
import { pesanTolakUbahVersi, versiBolehDiubah } from "@/lib/domain/versi-admin";
import { skemaIdVersi } from "@/lib/skema";
import { wajibAdmin } from "@/lib/sesi";

export const metadata: Metadata = { title: "Ubah Versi | Kyrion" };

interface HalamanUbahVersiProps {
  params: Promise<{ slug: string; versionId: string }>;
}

export default async function HalamanUbahVersi({ params }: HalamanUbahVersiProps) {
  await wajibAdmin();
  const { slug, versionId } = await params;
  const regulation = await getAdminRegulationBySlug(slug);
  if (!regulation || !skemaIdVersi.safeParse(versionId).success) notFound();
  // Versi hanya ditemukan bila milik regulasi pada URL.
  const version = await findVersion(regulation.id, versionId);
  if (!version) notFound();

  const kembali = `/admin/regulasi/${regulation.slug}/versi`;
  const { hari, bulan, tahun } = pecahTanggalIso(version.effectiveDate);

  return (
    <div className="mx-auto max-w-2xl p-4">
      <Link href={kembali} className="text-sm underline">
        ← Kembali ke Versi {regulation.name}
      </Link>
      <h1 className="mt-2 text-3xl font-bold">Ubah Versi {version.versionNumber}</h1>
      {versiBolehDiubah(version.status) ? (
        <FormVersi
          aksi={ubahVersi.bind(null, regulation.id, version.id)}
          nilaiAwal={{
            versionNumber: version.versionNumber,
            effectiveDay: String(hari),
            effectiveMonth: String(bulan),
            effectiveYear: String(tahun),
            changeSummary: version.changeSummary ?? "",
          }}
          labelTombol="Simpan perubahan"
        />
      ) : (
        // Tanpa form; server juga menolak bila action dipanggil langsung.
        <p role="status" className="mt-6 font-medium text-red-800">
          {pesanTolakUbahVersi(version.status)}
        </p>
      )}
    </div>
  );
}
