"use client";

import { useActionState } from "react";
import type { StatusForm } from "@/lib/status-form";

interface FormKategoriProps {
  /** Server Action tambah atau ganti nama (ganti nama sudah diikat ke ID lewat .bind). */
  aksi: (sebelumnya: StatusForm, formData: FormData) => Promise<StatusForm>;
  /** Isi awal untuk formulir ganti nama; kosong untuk formulir tambah. */
  nilaiAwal?: Record<string, string>;
  labelTombol: string;
}

export default function FormKategori({ aksi, nilaiAwal, labelTombol }: FormKategoriProps) {
  const [status, kirim, pending] = useActionState(aksi, { nilai: nilaiAwal });
  const g = status.galat;
  const n = status.nilai;

  return (
    <form action={kirim} className="mt-6 space-y-4">
      <div>
        <label htmlFor="name" className="font-medium">Nama kategori</label>
        <input
          id="name" name="name" required minLength={3} maxLength={50}
          defaultValue={n?.name} className="mt-1 block w-full rounded border px-3 py-2"
          aria-invalid={!!g?.name} aria-describedby="galat-name"
        />
        <p id="galat-name" className="text-sm text-red-700">{g?.name?.[0]}</p>
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
