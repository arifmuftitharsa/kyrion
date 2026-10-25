import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FormPerubahan from "@/components/FormPerubahan";
import { ubahPerubahan } from "@/app/admin/regulasi/[slug]/versi/[versionId]/perubahan/actions";
import { findChange } from "@/lib/data/changes";
import { getAdminRegulationBySlug } from "@/lib/data/regulations";
import { findVersion } from "@/lib/data/versions";
import { pesanTolakUbahPerubahan } from "@/lib/domain/perubahan";
import { versiBolehDiubah } from "@/lib/domain/versi-admin";
import { skemaIdPerubahan, skemaIdVersi } from "@/lib/skema";
import { wajibAdmin } from "@/lib/sesi";

export const metadata: Metadata = { title: "Ubah Perubahan | Kyrion" };

interface HalamanUbahPerubahanProps {
  params: Promise<{ slug: string; versionId: string; changeId: string }>;
}

export default async function HalamanUbahPerubahan({ params }: HalamanUbahPerubahanProps) {
  await wajibAdmin();
  const { slug, versionId, changeId } = await params;
  const regulation = await getAdminRegulationBySlug(slug);
  if (
    !regulation ||
    !skemaIdVersi.safeParse(versionId).success ||
    !skemaIdPerubahan.safeParse(changeId).success
  ) {
    notFound();
  }
  // Kepemilikan berantai: versi milik regulasi di URL, Change milik versi itu.
  const version = await findVersion(regulation.id, versionId);
  const change = version && (await findChange(version.id, changeId));
  if (!version || !change) notFound();

  const kembali = `/admin/regulasi/${regulation.slug}/versi/${version.id}/perubahan`;

  return (
    <div className="mx-auto max-w-2xl p-4">
      <Link href={kembali} className="text-sm underline">
        ← Kembali ke Perubahan Versi {version.versionNumber}
      </Link>
      <h1 className="mt-2 text-3xl font-bold">Ubah Perubahan</h1>
      {versiBolehDiubah(version.status) ? (
        <FormPerubahan
          aksi={ubahPerubahan.bind(null, regulation.id, version.id, change.id)}
          nilaiAwal={{
            description: change.description,
            source: change.source,
            page: change.page === null ? "" : String(change.page),
          }}
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
