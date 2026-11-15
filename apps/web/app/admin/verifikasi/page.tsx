import type { Metadata } from "next";
import FormPeriksaBerkas from "@/components/FormPeriksaBerkas";
import { wajibAdmin } from "@/lib/sesi";

export const metadata: Metadata = { title: "Periksa Berkas | Kyrion" };

export default async function HalamanPeriksaBerkas() {
  await wajibAdmin();

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <h1 className="text-3xl font-bold">Periksa Berkas</h1>
      <p className="text-slate-700">
        Unggah PDF untuk mencocokkannya dengan catatan resmi versi regulasi: sidik jari SHA-256,
        tag integritas, dan tanda tangan pengesahan diperiksa terhadap keyring.
      </p>
      <FormPeriksaBerkas />
    </div>
  );
}
