import StatusBadge from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";
import type { Version } from "@/lib/types";

interface CurrentVersionInfoProps {
  /** Apakah regulasi punya versi publik sama sekali. */
  hasVersions: boolean;
  /** Versi berlaku hari ini, dihitung halaman lewat lib/domain. */
  currentVersion: Version | undefined;
}

/** Satu baris ringkasan versi berlaku; dipakai kartu daftar dan halaman detail. */
export default function CurrentVersionInfo({
  hasVersions,
  currentVersion,
}: CurrentVersionInfoProps) {
  if (!hasVersions) {
    return <p className="text-sm text-slate-600">Belum ada versi.</p>;
  }

  if (!currentVersion) {
    return <p className="text-sm text-slate-600">Belum ada versi berlaku hari ini.</p>;
  }

  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-700">
      <span className="font-medium">
        Versi berlaku hari ini {currentVersion.versionNumber}
      </span>
      <StatusBadge status={currentVersion.status} />
      <span>
        sejak{" "}
        <time dateTime={currentVersion.effectiveDate}>
          {formatDate(currentVersion.effectiveDate)}
        </time>
      </span>
    </p>
  );
}
