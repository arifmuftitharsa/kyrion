"use client"; // error boundary wajib Client Component

import { focusRing } from "@/lib/styles";

export default function GalatUji({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div role="alert" className="space-y-2">
      <p className="font-semibold text-slate-900">Data uji gagal dimuat.</p>
      <p className="text-sm text-slate-700">Pesan: {error.message}</p>
      {error.digest && (
        <p className="text-sm text-slate-700">Kode: {error.digest}</p>
      )}
      <button
        type="button"
        onClick={() => retry()}
        className={`rounded border border-slate-500 px-3 py-1 text-slate-900 ${focusRing}`}
      >
        Coba lagi
      </button>
    </div>
  );
}