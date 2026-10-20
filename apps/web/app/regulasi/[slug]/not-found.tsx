import Link from "next/link";
import { focusRing } from "@/lib/styles";

export default function RegulationNotFound() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-slate-900">
        Regulasi tidak ditemukan
      </h1>
      <p className="max-w-3xl text-slate-700">
        Regulasi dengan alamat tersebut tidak ada di Kyrion. Periksa kembali
        alamatnya atau pilih dari daftar regulasi.
      </p>
      <Link
        href="/"
        className={`inline-block rounded font-medium text-blue-800 underline underline-offset-4 hover:text-blue-900 ${focusRing}`}
      >
        <span aria-hidden="true">← </span>Kembali ke Daftar Regulasi
      </Link>
    </div>
  );
}