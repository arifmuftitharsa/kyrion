"use client";

import { useActionState, useState, type ChangeEvent, type FormEvent } from "react";
import { periksaBerkas } from "@/app/admin/verifikasi/actions";
import type { StatusPeriksa } from "@/app/admin/verifikasi/status";
import HasilVerifikasiBerkas from "@/components/HasilVerifikasiBerkas";
import { PESAN_UKURAN_MAKS, melebihiBatasUkuran } from "@/lib/domain/berkas-pdf";

export default function FormPeriksaBerkas() {
  const [status, kirim, pending] = useActionState<StatusPeriksa, FormData>(periksaBerkas, {});
  // Cek ukuran di klien memakai batas dan teks yang sama dengan server (pola FormVersi).
  const [galatUkuran, setGalatUkuran] = useState<string>();
  const pesanBerkas = galatUkuran ?? status.galatBerkas;

  function periksaUkuran(berkas: File | undefined): boolean {
    const melebihi = berkas !== undefined && melebihiBatasUkuran(berkas.size);
    setGalatUkuran(melebihi ? PESAN_UKURAN_MAKS : undefined);
    return !melebihi;
  }

  function saatBerkasDipilih(event: ChangeEvent<HTMLInputElement>) {
    periksaUkuran(event.target.files?.[0]);
  }

  function saatKirim(event: FormEvent<HTMLFormElement>) {
    const input = event.currentTarget.elements.namedItem("berkas") as HTMLInputElement | null;
    if (!periksaUkuran(input?.files?.[0])) event.preventDefault();
  }

  return (
    <form action={kirim} onSubmit={saatKirim} className="mt-6 space-y-4">
      <div>
        <label htmlFor="berkas" className="font-medium">Berkas PDF</label>
        <input
          id="berkas" name="berkas" type="file" accept="application/pdf,.pdf" required
          onChange={saatBerkasDipilih} className="mt-1 block w-full rounded border px-3 py-2"
          aria-invalid={!!pesanBerkas} aria-describedby="petunjuk-berkas galat-berkas"
        />
        <p id="petunjuk-berkas" className="text-sm text-slate-600">
          PDF, maksimal 10 MB. Berkas hanya diperiksa, tidak disimpan.
        </p>
        <p id="galat-berkas" className="text-sm text-red-700">{pesanBerkas}</p>
      </div>
      <button
        type="submit" disabled={pending}
        className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-60"
      >
        {pending ? "Memeriksa..." : "Periksa berkas"}
      </button>
      <p role="status" aria-live="polite" className="font-medium text-red-800">{status.pesan}</p>
      {status.hasil && <HasilVerifikasiBerkas hasil={status.hasil} />}
    </form>
  );
}
