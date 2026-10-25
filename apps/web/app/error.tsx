"use client"; // batas galat wajib Client Component

import { useEffect } from "react";
import Link from "next/link";
import { focusRing } from "@/lib/styles";

/** Kode pencocok log server; nilai lempar dari Client Component belum tentu Error. */
function kodeGalat(error: unknown): string | undefined {
  return error instanceof Error && "digest" in error && typeof error.digest === "string"
    ? error.digest
    : undefined;
}

// Menangkap galat halaman dan layout bersarang (mis. basis data tidak terjangkau).
// Pesan dan stack sengaja tidak ditampilkan; cukup digest untuk dicocokkan dengan log.
export default function Galat({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = kodeGalat(error);

  useEffect(() => {
    console.error("galat aplikasi", digest);
  }, [digest]);

  return (
    <div role="alert" className="space-y-4">
      <h1 className="text-3xl font-bold text-slate-900">Terjadi gangguan</h1>
      <p className="max-w-3xl text-slate-700">
        Kyrion sedang tidak dapat memuat data. Silakan coba lagi beberapa saat lagi.
      </p>
      {digest && <p className="text-sm text-slate-600">Kode galat: {digest}</p>}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => retry()}
          className={`rounded border border-slate-500 px-3 py-1 font-medium text-slate-900 ${focusRing}`}
        >
          Coba lagi
        </button>
        <Link
          href="/"
          className={`inline-block rounded font-medium text-blue-800 underline underline-offset-4 hover:text-blue-900 ${focusRing}`}
        >
          <span aria-hidden="true">← </span>Kembali ke Daftar Regulasi
        </Link>
      </div>
    </div>
  );
}
