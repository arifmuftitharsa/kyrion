import Link from "next/link";
import { getRegulations } from "@/lib/data/regulations";
import { focusRing } from "@/lib/styles";

export default async function RegulasiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const regulations = await getRegulations();

  return (
    <div className="lg:grid lg:grid-cols-[16rem_1fr] lg:gap-8">
      <aside aria-label="Panel regulasi" className="mb-6 space-y-3">
        <p className="font-semibold text-slate-900">Regulasi lainnya</p>
        <ul className="space-y-1">
          {regulations.map((regulation) => (
            <li key={regulation.slug}>
              <Link
                href={`/regulasi/${regulation.slug}`}
                className={`rounded text-sm text-slate-700 underline-offset-4 hover:text-blue-800 hover:underline ${focusRing}`}
              >
                {regulation.name}
              </Link>
            </li>
          ))}
        </ul>
      </aside>
      <div>{children}</div>
    </div>
  );
}