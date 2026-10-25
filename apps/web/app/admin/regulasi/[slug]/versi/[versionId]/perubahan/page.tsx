import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import { getAdminChanges } from "@/lib/data/changes";
import { getAdminRegulationBySlug } from "@/lib/data/regulations";
import { findVersion } from "@/lib/data/versions";
import { versiBolehDiubah } from "@/lib/domain/versi-admin";
import { skemaIdVersi } from "@/lib/skema";
import { wajibAdmin } from "@/lib/sesi";
import { SUMBER_PERUBAHAN_LABEL } from "@/lib/types";

export const metadata: Metadata = { title: "Perubahan Versi | Kyrion" };

interface HalamanPerubahanProps {
  params: Promise<{ slug: string; versionId: string }>;
}

export default async function HalamanPerubahan({ params }: HalamanPerubahanProps) {
  await wajibAdmin();
  const { slug, versionId } = await params;
  const regulation = await getAdminRegulationBySlug(slug);
  if (!regulation || !skemaIdVersi.safeParse(versionId).success) notFound();
  // Versi hanya ditemukan bila milik regulasi pada URL.
  const version = await findVersion(regulation.id, versionId);
  if (!version) notFound();

  const changes = await getAdminChanges(version.id);
  const kembali = `/admin/regulasi/${regulation.slug}/versi`;
  const dasar = `${kembali}/${version.id}/perubahan`;
  const boleh = versiBolehDiubah(version.status);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <Link href={kembali} className="text-sm underline">
        ← Kembali ke Versi {regulation.name}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex flex-wrap items-center gap-2 text-3xl font-bold">
          Perubahan Versi {version.versionNumber} <StatusBadge status={version.status} />
        </h1>
        {boleh && (
          <Link href={`${dasar}/baru`} className="rounded bg-blue-700 px-4 py-2 text-white">
            Tambah Perubahan
          </Link>
        )}
      </div>
      <p className="text-sm text-gray-600">
        {boleh
          ? "Butir perubahan dicatat manual dan hanya dapat diubah selama versi berstatus Draf."
          : "Isi versi ini terkunci: perubahan tidak dapat ditambah, diubah, atau dihapus."}
      </p>

      {changes.length === 0 ? (
        <p className="text-slate-700">Belum ada perubahan tercatat.</p>
      ) : (
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Perubahan versi {version.versionNumber} {regulation.name}</caption>
          <thead>
            <tr className="border-b border-slate-300">
              <th scope="col" className="py-2 pr-4">Deskripsi</th>
              <th scope="col" className="py-2 pr-4">Sumber</th>
              <th scope="col" className="py-2 pr-4">Halaman</th>
              {boleh && <th scope="col" className="py-2">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {changes.map((change) => (
              <tr key={change.id} className="border-b border-slate-200 align-top">
                <td className="py-2 pr-4">{change.description}</td>
                <td className="py-2 pr-4">{SUMBER_PERUBAHAN_LABEL[change.source]}</td>
                <td className="py-2 pr-4">{change.page ?? "—"}</td>
                {boleh && (
                  <td className="flex gap-3 py-2">
                    <Link href={`${dasar}/${change.id}/ubah`} className="underline">Ubah</Link>
                    <Link href={`${dasar}/${change.id}/hapus`} className="text-red-800 underline">
                      Hapus
                    </Link>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
