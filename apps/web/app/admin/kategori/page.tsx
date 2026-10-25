import type { Metadata } from "next";
import Link from "next/link";
import { getAdminCategories } from "@/lib/data/categories";
import { wajibAdmin } from "@/lib/sesi";

export const metadata: Metadata = { title: "Kelola Kategori | Kyrion" };

export default async function HalamanKelolaKategori() {
  await wajibAdmin();
  const categories = await getAdminCategories();

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <Link href="/admin/regulasi" className="text-sm underline">
        ← Kembali ke Kelola Regulasi
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Kelola Kategori</h1>
        <Link href="/admin/kategori/baru" className="rounded bg-blue-700 px-4 py-2 text-white">
          Tambah Kategori
        </Link>
      </div>
      <p className="text-sm text-gray-600">
        Hanya kategori tanpa regulasi yang dapat dihapus. Nama yang mirip (beda huruf
        besar-kecil atau spasi) ditolak.
      </p>

      {categories.length === 0 ? (
        <p className="text-slate-700">Belum ada kategori.</p>
      ) : (
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Daftar kategori beserta jumlah regulasinya</caption>
          <thead>
            <tr className="border-b border-slate-300">
              <th scope="col" className="py-2 pr-4">Nama</th>
              <th scope="col" className="py-2 pr-4">Jumlah regulasi</th>
              <th scope="col" className="py-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id} className="border-b border-slate-200">
                <td className="py-2 pr-4">{category.name}</td>
                <td className="py-2 pr-4">{category.regulationCount}</td>
                <td className="flex gap-3 py-2">
                  {/* aria-label menyebut nama kategori agar tautan berbeda bagi pembaca layar. */}
                  <Link
                    href={`/admin/kategori/${category.slug}/ubah`}
                    aria-label={`Ganti nama ${category.name}`}
                    className="underline"
                  >
                    Ganti nama
                  </Link>
                  <Link
                    href={`/admin/kategori/${category.slug}/hapus`}
                    aria-label={`Hapus ${category.name}`}
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
