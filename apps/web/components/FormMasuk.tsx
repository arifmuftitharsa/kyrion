"use client";

import { useActionState } from "react";
import { masuk } from "@/app/masuk/actions";
import type { StatusForm } from "@/lib/status-form";

const awal: StatusForm = {};
const kolom = "mt-1 block w-full rounded border px-3 py-2";

export default function FormMasuk() {
  const [status, aksi, pending] = useActionState(masuk, awal);
  const g = status.galat;

  return (
    <form action={aksi} className="mt-6 space-y-4">
      <div>
        <label htmlFor="email" className="block font-medium">Email</label>
        <input
          id="email" name="email" type="email" autoComplete="username"
          className={kolom}
          aria-invalid={!!g?.email} aria-describedby="galat-email"
        />
        <p id="galat-email" className="text-sm text-red-700">{g?.email?.[0]}</p>
      </div>

      <div>
        <label htmlFor="kataSandi" className="block font-medium">Kata sandi</label>
        <input
          id="kataSandi" name="kataSandi" type="password"
          autoComplete="current-password" className={kolom}
          aria-invalid={!!g?.kataSandi} aria-describedby="galat-sandi"
        />
        <p id="galat-sandi" className="text-sm text-red-700">{g?.kataSandi?.[0]}</p>
      </div>

      <button
        type="submit" disabled={pending}
        className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-60"
      >
        {pending ? "Memeriksa..." : "Masuk"}
      </button>
      <p role="status" aria-live="polite">{status.pesan}</p>
    </form>
  );
}