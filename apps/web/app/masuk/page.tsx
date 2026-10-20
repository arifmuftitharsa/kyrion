import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Masuk | Kyrion",
};

export default function MasukPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-3xl font-bold text-slate-900">Masuk</h1>
      <p className="text-slate-700">
        Halaman ini masih placeholder. Fitur masuk akan tersedia di v0.2.
      </p>
    </div>
  );
}