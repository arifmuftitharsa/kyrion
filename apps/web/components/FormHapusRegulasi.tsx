"use client";

import { useActionState } from "react";
import type { StatusForm } from "@/lib/status-form";

interface FormHapusRegulasiProps {
  /** Server Action hapus yang sudah diikat ke ID lewat .bind. */
  aksi: (sebelumnya: StatusForm) => Promise<StatusForm>;
  namaRegulasi: string;
}

export default function FormHapusRegulasi({ aksi, namaRegulasi }: FormHapusRegulasiProps) {
  const [status, kirim, pending] = useActionState(aksi, {});

  return (
    <form action={kirim} className="mt-6 space-y-4">
      {/* Teks tombol menyebut nama regulasi agar jelas bagi pembaca layar. */}
      <button
        type="submit" disabled={pending}
        className="rounded bg-red-700 px-4 py-2 text-white disabled:opacity-60"
      >
        {pending ? "Menghapus..." : `Hapus regulasi ${namaRegulasi}`}
      </button>
      <p role="status" aria-live="polite" className="font-medium text-red-800">
        {status.pesan}
      </p>
    </form>
  );
}
