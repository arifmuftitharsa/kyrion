import type { Metadata } from "next";
import VerifyForm from "@/components/VerifyForm";
import { getRegulations } from "@/lib/data/regulations";

export const metadata: Metadata = {
  title: "Verifikasi Dokumen | Kyrion",
};

export default function VerifyPage() {
  // Data diambil di server lalu dikirim lewat props, sehingga komponen klien
  // tidak bergantung langsung pada sumber data (mudah diganti API nanti).
  const regulations = getRegulations();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Verifikasi Dokumen</h1>
        <p className="text-slate-700">
          Pilih regulasi dan versinya, lalu unggah dokumen PDF untuk
          dicocokkan. Pada v0.1 hasilnya masih simulasi.
        </p>
      </div>
      <VerifyForm regulations={regulations} />
    </div>
  );
}
