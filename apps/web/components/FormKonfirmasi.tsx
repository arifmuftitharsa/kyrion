"use client";

import { useActionState } from "react";
import type { StatusForm } from "@/lib/status-form";

interface FormKonfirmasiProps {
  /** Server Action yang sudah diikat ke ID lewat .bind. */
  aksi: (sebelumnya: StatusForm) => Promise<StatusForm>;
  /** Teks tombol yang menyebut objeknya, agar jelas bagi pembaca layar. */
  labelTombol: string;
  /** Teks tombol saat permintaan berjalan. */
  labelProses: string;
  varian: "utama" | "bahaya";
}

const KELAS_TOMBOL = {
  utama: "bg-blue-700",
  bahaya: "bg-red-700",
} as const;

/** Konfirmasi aksi generik (sahkan, batalkan); pola sama dengan FormHapus. */
export default function FormKonfirmasi({ aksi, labelTombol, labelProses, varian }: FormKonfirmasiProps) {
  const [status, kirim, pending] = useActionState(aksi, {});

  return (
    <form action={kirim} className="mt-6 space-y-4">
      <button
        type="submit" disabled={pending}
        className={`rounded px-4 py-2 text-white disabled:opacity-60 ${KELAS_TOMBOL[varian]}`}
      >
        {pending ? labelProses : labelTombol}
      </button>
      <p role="status" aria-live="polite" className="font-medium text-red-800">
        {status.pesan}
      </p>
    </form>
  );
}
