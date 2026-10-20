"use client"; // batas galat wajib Client Component

import { useEffect } from "react";
import { focusRing } from "@/lib/styles";

export default function GalatRegulasi({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("galat regulasi", error.digest);
  }, [error]);

  return (
    <div role="alert" className="space-y-3">
      <h1 className="text-2xl font-bold text-slate-900">
        Regulasi gagal dimuat
      </h1>
      <p className="text-slate-700">
        Terjadi masalah saat memuat regulasi. Silakan coba lagi.
      </p>
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