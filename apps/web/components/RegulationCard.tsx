import Link from "next/link";
import CurrentVersionInfo from "@/components/CurrentVersionInfo";
import { focusRing } from "@/lib/styles";
import type { Regulation, Version } from "@/lib/types";

interface RegulationCardProps {
  regulation: Regulation;
  /** Versi berlaku hari ini, dihitung halaman lewat lib/domain. */
  currentVersion: Version | undefined;
}

export default function RegulationCard({
  regulation,
  currentVersion,
}: RegulationCardProps) {
  return (
    // <article> karena tiap kartu adalah konten mandiri yang bermakna sendiri.
    <article className="flex h-full flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-600">{regulation.category}</p>
      <h2 className="text-lg font-semibold text-slate-900">
        <Link
          href={`/regulasi/${regulation.slug}`}
          className={`rounded underline-offset-4 hover:text-blue-800 hover:underline ${focusRing}`}
        >
          {regulation.name}
        </Link>
      </h2>
      {regulation.description && (
        <p className="text-slate-700">{regulation.description}</p>
      )}
      {/* mt-auto mendorong ringkasan versi ke dasar kartu. */}
      <div className="mt-auto">
        <CurrentVersionInfo
          hasVersions={regulation.versions.length > 0}
          currentVersion={currentVersion}
        />
      </div>
    </article>
  );
}
