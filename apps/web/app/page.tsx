import CategoryFilter from "@/components/CategoryFilter";
import RegulationCard from "@/components/RegulationCard";
import { getCategories, getRegulationsByCategory } from "@/lib/data/regulations";
import { todayInJakarta } from "@/lib/domain/tanggal";
import { findEffectiveVersion } from "@/lib/domain/versi";

interface HomePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Hanya menerima kategori yang benar-benar ada. Nilai lain (mis. ketikan manual
 * di URL atau parameter ganda berupa array) diabaikan sehingga tampil "Semua".
 */
function resolveCategory(
  raw: string | string[] | undefined,
  categories: string[],
): string | undefined {
  return typeof raw === "string" && categories.includes(raw) ? raw : undefined;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  // Di Next.js 16 searchParams berupa Promise, jadi wajib di-await.
  const { kategori } = await searchParams;
  const categories = await getCategories();
  const activeCategory = resolveCategory(kategori, categories);
  const regulations = await getRegulationsByCategory(activeCategory);
  // Satu tanggal acuan untuk semua kartu dalam satu request.
  const today = todayInJakarta(new Date());

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Daftar Regulasi</h1>
      <CategoryFilter categories={categories} active={activeCategory} />

      {regulations.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {regulations.map((regulation) => (
            <li key={regulation.slug}>
              <RegulationCard
                regulation={regulation}
                currentVersion={findEffectiveVersion(regulation.versions, today)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-400 bg-white p-6 text-center text-slate-700">
          Belum ada regulasi pada kategori ini.
        </p>
      )}
    </div>
  );
}
