import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FormHapus from "@/components/FormHapus";
import { hapusPerubahan } from "@/app/admin/regulasi/[slug]/versi/[versionId]/perubahan/actions";
import { findChange } from "@/lib/data/changes";
import { getAdminRegulationBySlug } from "@/lib/data/regulations";
import { findVersion } from "@/lib/data/versions";
import { pesanTolakHapusPerubahan } from "@/lib/domain/perubahan";
import { versiBolehDiubah } from "@/lib/domain/versi-admin";
import { skemaIdPerubahan, skemaIdVersi } from "@/lib/skema";
import { wajibAdmin } from "@/lib/sesi";

export const metadata: Metadata = { title: "Hapus Perubahan | Kyrion" };

interface HalamanHapusPerubahanProps {
  params: Promise<{ slug: string; versionId: string; changeId: string }>;
}

export default async function HalamanHapusPerubahan({ params }: HalamanHapusPerubahanProps) {
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
  const version = await findVersion(regulation.id, versionId);
  const change = version && (await findChange(version.id, changeId));
  if (!version || !change) notFound();

  const kembali = `/admin/regulasi/${regulation.slug}/versi/${version.id}/perubahan`;
  const boleh = versiBolehDiubah(version.status);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <Link href={kembali} className="text-sm underline">
        ← Kembali ke Perubahan Versi {version.versionNumber}
      </Link>
      <h1 className="text-3xl font-bold">Hapus Perubahan</h1>
      {boleh ? (
        <>
          <p>
            Anda akan menghapus perubahan berikut dari versi{" "}
            <strong>{version.versionNumber}</strong> secara permanen:
          </p>
          <blockquote className="border-l-4 border-slate-300 pl-3 text-slate-700">
            {change.description}
          </blockquote>
          <FormHapus
            aksi={hapusPerubahan.bind(null, regulation.id, version.id, change.id)}
            labelTombol="Hapus perubahan"
          />
        </>
      ) : (
        // Tanpa form; server juga menolak bila action dipanggil langsung.
        <p role="status" className="font-medium text-red-800">
          {pesanTolakHapusPerubahan(version.status)}
        </p>
      )}
      <Link href={kembali} className="inline-block underline">
        {boleh ? "Batal" : "Kembali"}
      </Link>
    </div>
  );
}
