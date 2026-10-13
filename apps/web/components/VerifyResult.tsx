import StatusBadge from "@/components/StatusBadge";
import type { VersionStatus } from "@/lib/types";

interface VerifyResultProps {
  regulationName: string;
  versionNumber: string;
  status: VersionStatus;
  fileName: string;
}

export default function VerifyResult({
  regulationName,
  versionNumber,
  status,
  fileName,
}: VerifyResultProps) {
  return (
    // role="status" membuat pembaca layar mengumumkan hasil tanpa memindahkan fokus.
    <div
      role="status"
      className="rounded-lg border border-blue-200 bg-blue-50 p-5 text-slate-800"
    >
      <h2 className="text-lg font-semibold text-slate-900">
        Hasil Verifikasi (Simulasi)
      </h2>
      <dl className="mt-3 grid gap-2 sm:grid-cols-[max-content_1fr] sm:gap-x-4">
        <dt className="font-medium">Dokumen</dt>
        <dd className="break-all">{fileName}</dd>
        <dt className="font-medium">Regulasi</dt>
        <dd>{regulationName}</dd>
        <dt className="font-medium">Versi</dt>
        <dd className="flex flex-wrap items-center gap-2">
          {versionNumber} <StatusBadge status={status} />
        </dd>
      </dl>
      {/* Penegasan wajib: v0.1 belum memverifikasi isi dokumen secara nyata. */}
      <p className="mt-4 text-sm font-medium text-slate-700">
        Ini hanya simulasi dengan data tiruan. Pencocokan hash dokumen belum
        diterapkan di v0.1.
      </p>
    </div>
  );
}
