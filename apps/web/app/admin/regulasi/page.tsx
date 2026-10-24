import type { Metadata } from "next";
import Link from "next/link";
import { keluar } from "@/app/masuk/actions";
import { getAdminRegulations } from "@/lib/data/regulations";
import { wajibAdmin } from "@/lib/sesi";

export const metadata: Metadata = { title: "Kelola Regulasi | Kyrion" };

export default async function HalamanKelolaRegulasi() {
  const sesi = await wajibAdmin();
  const regulations = await getAdminRegulations();

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Kelola Regulasi</h1>
        <Link href="/admin/regulasi/baru" className="rounded bg-blue-700 px-4 py-2 text-white">
          Tambah Regulasi
        </Link>
      </div>
      <div className="flex items-center gap-3 text-sm text-gray-600">
        <p>Masuk sebagai {sesi.email}</p>
        <form action={keluar}>
          <button type="submit" className="underline">Keluar</button>
        </form>
      </div>

      {regulations.length === 0 ? (
        <p className="text-slate-700">Belum ada regulasi.</p>
      ) : (
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Daftar regulasi beserta jumlah versinya</caption>
          <thead>
            <tr className="border-b border-slate-300">
              <th scope="col" className="py-2 pr-4">Nama</th>
              <th scope="col" className="py-2 pr-4">Kategori</th>
              <th scope="col" className="py-2 pr-4">Jumlah versi</th>
              <th scope="col" className="py-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {regulations.map((regulation) => (
              <tr key={regulation.id} className="border-b border-slate-200">
                <td className="py-2 pr-4">
                  <Link href={`/regulasi/${regulation.slug}`} className="underline">
                    {regulation.name}
                  </Link>
                </td>
                <td className="py-2 pr-4">{regulation.category}</td>
                <td className="py-2 pr-4">{regulation.versionCount}</td>
                <td className="flex gap-3 py-2">
                  {/* aria-label menyebut nama regulasi agar tautan berbeda bagi pembaca layar. */}
                  <Link
                    href={`/admin/regulasi/${regulation.slug}/versi`}
                    aria-label={`Versi ${regulation.name}`}
                    className="underline"
                  >
                    Versi
                  </Link>
                  <Link
                    href={`/admin/regulasi/${regulation.slug}/ubah`}
                    aria-label={`Ubah ${regulation.name}`}
                    className="underline"
                  >
                    Ubah
                  </Link>
                  <Link
                    href={`/admin/regulasi/${regulation.slug}/hapus`}
                    aria-label={`Hapus ${regulation.name}`}
                    className="text-red-800 underline"
                  >
                    Hapus
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
