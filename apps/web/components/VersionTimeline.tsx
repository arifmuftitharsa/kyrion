import StatusBadge from "@/components/StatusBadge";
import { sortVersionsNewestFirst } from "@/lib/data/regulations";
import { formatDate } from "@/lib/format";
import type { Version } from "@/lib/types";

interface VersionTimelineProps {
  versions: Version[];
}

export default function VersionTimeline({ versions }: VersionTimelineProps) {
  // Versi terbaru di atas karena pengguna paling sering mencari aturan yang berlaku.
  const sortedVersions = sortVersionsNewestFirst(versions);

  return (
    // <ol> dipakai karena urutan riwayat versi bermakna (kronologis).
    <ol className="space-y-4 border-l-2 border-slate-300 pl-6">
      {sortedVersions.map((version) => (
        <li key={version.versionNumber} className="relative">
          <span
            aria-hidden="true"
            className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-slate-500"
          />
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-900">
              Versi {version.versionNumber}
            </h3>
            <StatusBadge status={version.status} />
          </div>
          <p className="text-sm text-slate-600">
            Berlaku sejak{" "}
            <time dateTime={version.effectiveDate}>
              {formatDate(version.effectiveDate)}
            </time>
          </p>
          <p className="mt-1 text-slate-700">{version.changeSummary}</p>
        </li>
      ))}
    </ol>
  );
}
