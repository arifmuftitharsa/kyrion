"use client";

import { useActionState } from "react";
import { simpanRegulasi } from "@/app/admin/regulasi/actions";
import { KATEGORI } from "@/lib/types";
import type { StatusForm } from "@/lib/status-form";

const awal: StatusForm = {};
const kolom = "mt-1 block w-full rounded border px-3 py-2";

export default function FormRegulasi() {
  const [status, aksi, pending] = useActionState(simpanRegulasi, awal);
  const g = status.galat;
  const n = status.nilai;

  return (
    <form action={aksi} className="mt-6 space-y-4">
      <div>
        <label htmlFor="name" className="font-medium">Nama regulasi</label>
        <input
          id="name" name="name" required minLength={5} maxLength={120}
          defaultValue={n?.name} className={kolom}
          aria-invalid={!!g?.name} aria-describedby="galat-name"
        />
        <p id="galat-name" className="text-sm text-red-700">{g?.name?.[0]}</p>
      </div>

      <div>
        <label htmlFor="category" className="font-medium">Kategori</label>
        <select
          id="category" name="category" required
          key={n?.category ?? "awal"} defaultValue={n?.category ?? ""}
          className={kolom}
          aria-invalid={!!g?.category} aria-describedby="galat-category"
        >
          <option value="" disabled>Pilih kategori</option>
          {KATEGORI.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
        <p id="galat-category" className="text-sm text-red-700">{g?.category?.[0]}</p>
      </div>

      <div>
        <label htmlFor="description" className="font-medium">Deskripsi</label>
        <textarea
          id="description" name="description" required minLength={10} maxLength={300}
          rows={4} defaultValue={n?.description} className={kolom}
          aria-invalid={!!g?.description} aria-describedby="galat-description"
        />
        <p id="galat-description" className="text-sm text-red-700">{g?.description?.[0]}</p>
      </div>

      <button
        type="submit" disabled={pending}
        className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-60"
      >
        {pending ? "Menyimpan..." : "Simpan"}
      </button>
      <p role="status" aria-live="polite">{status.pesan}</p>
    </form>
  );
}