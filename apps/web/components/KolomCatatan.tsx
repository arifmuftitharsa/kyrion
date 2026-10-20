"use client";

import { useId, useState } from "react";

interface KolomCatatanProps {
  label: string;
}

export default function KolomCatatan({ label }: KolomCatatanProps) {
  const id = useId();
  const [catatan, setCatatan] = useState("");

  return (
    <div className="rounded border border-dashed border-slate-400 p-3 text-sm">
      <label htmlFor={id} className="font-medium text-slate-900">
        {label}
      </label>
      <input
        id={id}
        value={catatan}
        onChange={(event) => setCatatan(event.target.value)}
        className="mt-1 block w-full rounded border border-slate-500 bg-white px-2 py-1 text-slate-900"
      />
    </div>
  );
}