import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import { getAdminRegulationBySlug } from "@/lib/data/regulations";
import { getAdminVersions } from "@/lib/data/versions";
import { versiBolehDihapus, versiBolehDiubah } from "@/lib/domain/versi-admin";
import { formatDate, formatUkuranBerkas } from "@/lib/format";
import { wajibAdmin } from "@/lib/sesi";

export const metadata: Metadata = { title: "Kelola Versi | Kyrion" };

interface HalamanKelolaVersiProps {
  params: Promise<{ slug: string }>;
}

export default async function HalamanKelolaVersi({ params }: HalamanKelolaVersiProps) {
  await wajibAdmin();
  const { slug } = await params;
  const regulation = await getAdminRegulationBySlug(slug);
  if (!regulation) notFound();
  // Semua status ditampilkan untuk admin, berbeda dengan halaman publik.
  const versions = await getAdminVersions(regulation.id);
  const dasar = `/admin/regulasi/${regulation.slug}/versi`;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <Link href="/admin/regulasi" className="text-sm underline">
        ← Kembali ke Kelola Regulasi
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Versi {regulation.name}</h1>
        <Link href={`${dasar}/baru`} className="rounded bg-blue-700 px-4 py-2 text-white">
          Tambah Versi
        </Link>
      </div>
      <p className="text-sm text-gray-600">
        Hanya versi Draf yang dapat diubah atau dihapus. Pengesahan dan pembatalan
        versi belum tersedia di v0.2.
      </p>

      {versions.length === 0 ? (
        <p className="text-slate-700">Belum ada versi.</p>
      ) : (
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Daftar semua versi {regulation.name}</caption>
          <thead>
            <tr className="border-b border-slate-300">
              <th scope="col" className="py-2 pr-4">Nomor</th>
              <th scope="col" className="py-2 pr-4">Mulai berlaku</th>
              <th scope="col" className="py-2 pr-4">Status</th>
              <th scope="col" className="py-2 pr-4">Ringkasan</th>
              <th scope="col" className="py-2 pr-4">Berkas</th>
              <th scope="col" className="py-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((version) => (
              <tr key={version.id} className="border-b border-slate-200 align-top">
                <td className="py-2 pr-4">{version.versionNumber}</td>
                <td className="py-2 pr-4">
                  <time dateTime={version.effectiveDate}>{formatDate(version.effectiveDate)}</time>
                </td>
                <td className="py-2 pr-4"><StatusBadge status={version.status} /></td>
                <td className="py-2 pr-4">{version.changeSummary ?? "—"}</td>
                <td className="py-2 pr-4">
                  {version.fileSize !== null ? (
                    <Link
                      href={`${dasar}/${version.id}/berkas`}
                      aria-label={`Unduh PDF versi ${version.versionNumber}`}
                      className="underline"
                    >
                      Unduh PDF ({formatUkuranBerkas(version.fileSize)})
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="flex gap-3 py-2">
                  {/* Tombol hanya untuk DRAF; server tetap menolak status lain. */}
                  {versiBolehDiubah(version.status) && (
                    <Link
                      href={`${dasar}/${version.id}/ubah`}
                      aria-label={`Ubah versi ${version.versionNumber}`}
                      className="underline"
                    >
                      Ubah
                    </Link>
                  )}
                  {versiBolehDihapus(version.status) && (
                    <Link
                      href={`${dasar}/${version.id}/hapus`}
                      aria-label={`Hapus versi ${version.versionNumber}`}
                      className="text-red-800 underline"
                    >
                      Hapus
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
