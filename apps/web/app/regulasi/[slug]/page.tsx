import Link from "next/link";
import { notFound } from "next/navigation";
import VersionTimeline from "@/components/VersionTimeline";
import { getRegulationBySlug } from "@/lib/data/regulations";
import { focusRing } from "@/lib/styles";

interface RegulationDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function RegulationDetailPage({
  params,
}: RegulationDetailPageProps) {
  // Di Next.js 16 params berupa Promise, jadi wajib di-await.
  const { slug } = await params;
  const regulation = getRegulationBySlug(slug);

  // Slug tidak dikenal ditangani sebagai 404, bukan halaman kosong.
  if (!regulation) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className={`inline-block rounded font-medium text-blue-800 underline underline-offset-4 hover:text-blue-900 ${focusRing}`}
      >
        <span aria-hidden="true">← </span>Kembali ke Daftar Regulasi
      </Link>

      <header className="space-y-2">
        <p className="text-sm font-medium text-slate-600">{regulation.category}</p>
        <h1 className="text-3xl font-bold text-slate-900">{regulation.name}</h1>
        <p className="max-w-3xl text-slate-700">{regulation.description}</p>
      </header>

      {/* aria-labelledby menamai section dari judulnya sehingga muncul sebagai landmark. */}
      <section
        aria-labelledby="riwayat-versi"
        className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h2 id="riwayat-versi" className="mb-4 text-xl font-semibold text-slate-900">
          Riwayat Versi
        </h2>
        <VersionTimeline versions={regulation.versions} />
      </section>
    </div>
  );
}
