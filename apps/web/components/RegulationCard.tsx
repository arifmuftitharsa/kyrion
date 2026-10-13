import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import { getCurrentVersion } from "@/lib/data/regulations";
import { formatDate } from "@/lib/format";
import { focusRing } from "@/lib/styles";
import type { Regulation } from "@/lib/types";

interface RegulationCardProps {
  regulation: Regulation;
}

export default function RegulationCard({ regulation }: RegulationCardProps) {
  const currentVersion = getCurrentVersion(regulation);

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
      <p className="text-slate-700">{regulation.description}</p>
      {currentVersion ? (
        <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-700">
          <span className="font-medium">
            Versi berlaku {currentVersion.versionNumber}
          </span>
          <StatusBadge status={currentVersion.status} />
          <time dateTime={currentVersion.effectiveDate}>
            {formatDate(currentVersion.effectiveDate)}
          </time>
        </p>
      ) : (
        <p className="mt-auto text-sm text-slate-600">Belum ada versi berlaku.</p>
      )}
    </article>
  );
}
