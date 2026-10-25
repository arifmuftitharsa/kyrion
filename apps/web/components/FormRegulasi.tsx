"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { StatusForm } from "@/lib/status-form";

const kolom = "mt-1 block w-full rounded border px-3 py-2";

interface FormRegulasiProps {
  /** Server Action tambah atau ubah (ubah sudah diikat ke ID lewat .bind). */
  aksi: (sebelumnya: StatusForm, formData: FormData) => Promise<StatusForm>;
  /** Pilihan kategori dari basis data. */
  kategori: { id: string; name: string }[];
  /** Isi awal untuk formulir ubah; kosong untuk formulir tambah. */
  nilaiAwal?: Record<string, string>;
  labelTombol: string;
}

export default function FormRegulasi({ aksi, kategori, nilaiAwal, labelTombol }: FormRegulasiProps) {
  const [status, kirim, pending] = useActionState(aksi, { nilai: nilaiAwal });
  const g = status.galat;
  const n = status.nilai;

  return (
    <form action={kirim} className="mt-6 space-y-4">
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
        <label htmlFor="categoryId" className="font-medium">Kategori</label>
        <select
          id="categoryId" name="categoryId" required
          key={n?.categoryId ?? "awal"} defaultValue={n?.categoryId ?? ""}
          className={kolom}
          aria-invalid={!!g?.categoryId} aria-describedby="galat-categoryId"
        >
          <option value="" disabled>Pilih kategori</option>
          {kategori.map((k) => (
            <option key={k.id} value={k.id}>{k.name}</option>
          ))}
        </select>
        {kategori.length === 0 && (
          <p className="text-sm text-slate-600">
            Belum ada kategori.{" "}
            <Link href="/admin/kategori/baru" className="underline">Tambah kategori</Link> dulu.
          </p>
        )}
        <p id="galat-categoryId" className="text-sm text-red-700">{g?.categoryId?.[0]}</p>
      </div>

      <div>
        <label htmlFor="description" className="font-medium">
          Deskripsi <span className="font-normal text-slate-600">(opsional)</span>
        </label>
        <textarea
          id="description" name="description" maxLength={300}
          rows={4} defaultValue={n?.description}
          className={kolom}
          aria-invalid={!!g?.description} aria-describedby="galat-description"
        />
        <p id="galat-description" className="text-sm text-red-700">{g?.description?.[0]}</p>
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
