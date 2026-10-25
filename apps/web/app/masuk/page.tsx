import type { Metadata } from "next";
import FormMasuk from "@/components/FormMasuk";

export const metadata: Metadata = {
  title: "Masuk | Kyrion",
};

export default function MasukPage() {
  return (
    <div className="mx-auto max-w-md space-y-2">
      <h1 className="text-3xl font-bold text-slate-900">Masuk</h1>
      <FormMasuk />
    </div>
  );
}