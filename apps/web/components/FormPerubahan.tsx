"use client";

import { useActionState } from "react";
import type { StatusForm } from "@/lib/status-form";
import { SUMBER_PERUBAHAN_LABEL, type ChangeSource } from "@/lib/types";

const kolom = "mt-1 block w-full rounded border px-3 py-2";

interface FormPerubahanProps {
  /** Server Action tambah atau ubah, sudah diikat ke ID lewat .bind. */
  aksi: (sebelumnya: StatusForm, formData: FormData) => Promise<StatusForm>;
  /** Isi awal untuk formulir ubah; kosong untuk formulir tambah. */
  nilaiAwal?: Record<string, string>;
  labelTombol: string;
}

export default function FormPerubahan({ aksi, nilaiAwal, labelTombol }: FormPerubahanProps) {
  const [status, kirim, pending] = useActionState(aksi, { nilai: nilaiAwal });
  const g = status.galat;
  const n = status.nilai;

  return (
    <form action={kirim} className="mt-6 space-y-4">
      <div>
        <label htmlFor="description" className="font-medium">Deskripsi perubahan</label>
        <textarea
          id="description" name="description" required maxLength={500} rows={4}
          defaultValue={n?.description} className={kolom}
          aria-invalid={!!g?.description} aria-describedby="galat-description"
        />
        <p id="galat-description" className="text-sm text-red-700">{g?.description?.[0]}</p>
      </div>

      <div>
        <label htmlFor="source" className="font-medium">Sumber</label>
        <select
          id="source" name="source" required
          key={n?.source ?? "awal"} defaultValue={n?.source ?? ""} className={kolom}
          aria-invalid={!!g?.source} aria-describedby="galat-source"
        >
          <option value="">Pilih sumber</option>
          {(Object.keys(SUMBER_PERUBAHAN_LABEL) as ChangeSource[]).map((sumber) => (
            <option key={sumber} value={sumber}>{SUMBER_PERUBAHAN_LABEL[sumber]}</option>
          ))}
        </select>
        <p id="galat-source" className="text-sm text-red-700">{g?.source?.[0]}</p>
      </div>

      <div>
        <label htmlFor="page" className="font-medium">
          Halaman <span className="font-normal text-slate-600">(opsional)</span>
        </label>
        <input
          id="page" name="page" inputMode="numeric" maxLength={5} autoComplete="off"
          defaultValue={n?.page} className="mt-1 block w-28 rounded border px-3 py-2"
          aria-invalid={!!g?.page} aria-describedby="petunjuk-page galat-page"
        />
        <p id="petunjuk-page" className="text-sm text-slate-600">
          Halaman di dokumen sumber, bilangan bulat 1 sampai 10000.
        </p>
        <p id="galat-page" className="text-sm text-red-700">{g?.page?.[0]}</p>
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
