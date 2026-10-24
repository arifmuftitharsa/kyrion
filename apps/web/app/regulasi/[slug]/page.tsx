import Link from "next/link";
import { notFound } from "next/navigation";
import CurrentVersionInfo from "@/components/CurrentVersionInfo";
import VersionTimeline from "@/components/VersionTimeline";
import { getRegulationBySlug } from "@/lib/data/regulations";
import { todayInJakarta } from "@/lib/domain/tanggal";
import { findEffectiveVersion } from "@/lib/domain/versi";
import { focusRing } from "@/lib/styles";

// Bentuk slug yang sah: huruf kecil/angka, dipisah satu strip.
const FORMAT_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface RegulationDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function RegulationDetailPage({
  params,
}: RegulationDetailPageProps) {
  // Di Next.js 16 params berupa Promise, jadi wajib di-await.
  const { slug } = await params;

  // Cek bentuk dulu: murah, dan tidak perlu menyentuh data.
  if (!FORMAT_SLUG.test(slug)) notFound();

  const regulation = await getRegulationBySlug(slug);

  // Slug yang bentuknya wajar tetapi tidak ada di data juga 404.
  if (!regulation) notFound();

  // Satu tanggal acuan untuk ringkasan dan timeline dalam satu request.
  const today = todayInJakarta(new Date());

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
        {regulation.description && (
          <p className="max-w-3xl text-slate-700">{regulation.description}</p>
        )}
        {/* Tanpa versi, keadaan kosong cukup ditampilkan VersionTimeline. */}
        {regulation.versions.length > 0 && (
          <CurrentVersionInfo
            hasVersions
            currentVersion={findEffectiveVersion(regulation.versions, today)}
          />
        )}
      </header>

      {/* aria-labelledby menamai section dari judulnya sehingga muncul sebagai landmark. */}
      <section
        aria-labelledby="riwayat-versi"
        className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h2 id="riwayat-versi" className="mb-4 text-xl font-semibold text-slate-900">
          Riwayat Versi
        </h2>
        <VersionTimeline versions={regulation.versions} today={today} />
      </section>
    </div>
  );
}