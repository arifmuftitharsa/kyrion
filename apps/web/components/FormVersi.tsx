"use client";

import { useActionState } from "react";
import { NAMA_BULAN } from "@/lib/domain/tanggal";
import type { StatusForm } from "@/lib/status-form";

const kolom = "mt-1 block w-full rounded border px-3 py-2";

interface FormVersiProps {
  /** Server Action tambah atau ubah versi, sudah diikat ke ID lewat .bind. */
  aksi: (sebelumnya: StatusForm, formData: FormData) => Promise<StatusForm>;
  /** Isi awal untuk formulir ubah; kosong untuk formulir tambah. */
  nilaiAwal?: Record<string, string>;
  labelTombol: string;
}

export default function FormVersi({ aksi, nilaiAwal, labelTombol }: FormVersiProps) {
  const [status, kirim, pending] = useActionState(aksi, { nilai: nilaiAwal });
  const g = status.galat;
  const n = status.nilai;
  // Tanggal mustahil (mis. 31 Juni) menandai ketiga kolom; galat per kolom hanya kolom itu.
  const galatTanggalUtuh = g?.effectiveDate?.[0];
  const galatTanggal =
    g?.effectiveDay?.[0] ?? g?.effectiveMonth?.[0] ?? g?.effectiveYear?.[0] ?? galatTanggalUtuh;
  const tidakValid = (kolom: string) => !!g?.[kolom] || !!galatTanggalUtuh;

  return (
    <form action={kirim} className="mt-6 space-y-4">
      <div>
        <label htmlFor="versionNumber" className="font-medium">Nomor versi</label>
        <input
          id="versionNumber" name="versionNumber" required maxLength={30}
          defaultValue={n?.versionNumber} className={kolom}
          aria-invalid={!!g?.versionNumber} aria-describedby="petunjuk-versionNumber galat-versionNumber"
        />
        <p id="petunjuk-versionNumber" className="text-sm text-slate-600">
          Teks bebas sesuai dokumen, mis. 2024/2025, 2025, atau 11.
        </p>
        <p id="galat-versionNumber" className="text-sm text-red-700">{g?.versionNumber?.[0]}</p>
      </div>

      {/* Tiga kolom terpisah (pola GOV.UK date input): urutan tidak bergantung bahasa browser. */}
      <fieldset aria-describedby="petunjuk-tanggal galat-tanggal">
        <legend className="font-medium">Tanggal mulai berlaku</legend>
        <p id="petunjuk-tanggal" className="text-sm text-slate-600">Contoh: 27 Maret 2026</p>
        <div className="mt-1 flex flex-wrap gap-3">
          <div>
            <label htmlFor="effectiveDay" className="block text-sm">Tanggal</label>
            <input
              id="effectiveDay" name="effectiveDay" inputMode="numeric" maxLength={2}
              autoComplete="off" required defaultValue={n?.effectiveDay}
              className="mt-1 w-16 rounded border px-3 py-2"
              aria-invalid={tidakValid("effectiveDay")} aria-describedby="galat-tanggal"
            />
          </div>
          <div>
            <label htmlFor="effectiveMonth" className="block text-sm">Bulan</label>
            <select
              id="effectiveMonth" name="effectiveMonth" required
              key={n?.effectiveMonth ?? "awal"} defaultValue={n?.effectiveMonth ?? ""}
              className="mt-1 rounded border px-3 py-2"
              aria-invalid={tidakValid("effectiveMonth")} aria-describedby="galat-tanggal"
            >
              <option value="">Pilih bulan</option>
              {NAMA_BULAN.map((nama, indeks) => (
                <option key={nama} value={indeks + 1}>{nama}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="effectiveYear" className="block text-sm">Tahun</label>
            <input
              id="effectiveYear" name="effectiveYear" inputMode="numeric" maxLength={4}
              autoComplete="off" required defaultValue={n?.effectiveYear}
              className="mt-1 w-24 rounded border px-3 py-2"
              aria-invalid={tidakValid("effectiveYear")} aria-describedby="galat-tanggal"
            />
          </div>
        </div>
        <p id="galat-tanggal" className="text-sm text-red-700">{galatTanggal}</p>
      </fieldset>

      <div>
        <label htmlFor="changeSummary" className="font-medium">
          Ringkasan perubahan <span className="font-normal text-slate-600">(opsional)</span>
        </label>
        <textarea
          id="changeSummary" name="changeSummary" maxLength={500} rows={4}
          defaultValue={n?.changeSummary} className={kolom}
          aria-invalid={!!g?.changeSummary} aria-describedby="galat-changeSummary"
        />
        <p id="galat-changeSummary" className="text-sm text-red-700">{g?.changeSummary?.[0]}</p>
      </div>

      <button
        type="submit" disabled={pending}
        className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-60"
      >
        {pending ? "Menyimpan..." : labelTombol}
      </button>
      <p role="status" aria-live="polite">{status.pesan}</p>
    </form>
  );
}
