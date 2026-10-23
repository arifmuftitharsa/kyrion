import type { Metadata } from "next";
import FormRegulasi from "@/components/FormRegulasi";

export const metadata: Metadata = { title: "Tambah Regulasi | Kyrion" };

// Pemeriksaan sesi ditambahkan di Bagian 4
export default function HalamanTambahRegulasi() {
  return (
    <div className="mx-auto max-w-2xl p-4">
      <h1 className="text-3xl font-bold">Tambah Regulasi</h1>
      <FormRegulasi />
    </div>
  );
}