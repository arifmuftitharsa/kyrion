import type { Metadata } from "next";
import { redirect } from "next/navigation";
import FormMasuk from "@/components/FormMasuk";
import { bacaSesi } from "@/lib/sesi";

export const metadata: Metadata = {
  title: "Masuk | Kyrion",
};

export default async function MasukPage() {
  const sesi = await bacaSesi();
  if (sesi) redirect(sesi.role === "ADMIN" ? "/admin/regulasi" : "/");

  return (
    <div className="mx-auto max-w-md space-y-2">
      <h1 className="text-3xl font-bold text-slate-900">Masuk</h1>
      <FormMasuk />
    </div>
  );
}
