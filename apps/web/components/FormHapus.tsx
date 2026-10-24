"use client";

import { useActionState } from "react";
import type { StatusForm } from "@/lib/status-form";

interface FormHapusProps {
  /** Server Action hapus yang sudah diikat ke ID lewat .bind. */
  aksi: (sebelumnya: StatusForm) => Promise<StatusForm>;
  /** Teks tombol yang menyebut objeknya, mis. "Hapus regulasi X", agar jelas bagi pembaca layar. */
  labelTombol: string;
}

/** Konfirmasi hapus generik: dipakai hapus regulasi dan hapus versi. */
export default function FormHapus({ aksi, labelTombol }: FormHapusProps) {
  const [status, kirim, pending] = useActionState(aksi, {});

  return (
    <form action={kirim} className="mt-6 space-y-4">
      <button
        type="submit" disabled={pending}
        className="rounded bg-red-700 px-4 py-2 text-white disabled:opacity-60"
      >
        {pending ? "Menghapus..." : labelTombol}
      </button>
      <p role="status" aria-live="polite" className="font-medium text-red-800">
        {status.pesan}
      </p>
    </form>
  );
}
