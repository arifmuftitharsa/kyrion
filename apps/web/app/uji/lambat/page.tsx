import { connection } from "next/server";

export default async function UjiLambatPage() {
  // Tandai halaman sebagai dinamis: dirender saat ada permintaan, bukan saat build.
  await connection();

  // Simulasi pengambilan data yang lambat (10 detik).
  await new Promise((resolve) => setTimeout(resolve, 10000));

  return (
    <div className="space-y-2">
      <h1 className="text-3xl font-bold text-slate-900">Uji halaman lambat</h1>
      <p className="text-slate-700">Data selesai dimuat.</p>
    </div>
  );
}