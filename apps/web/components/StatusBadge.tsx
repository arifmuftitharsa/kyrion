import type { VersionStatus } from "@/lib/types";

interface StatusBadgeProps {
  status: VersionStatus;
}

// Status dibedakan lewat warna + simbol + teks sekaligus, sehingga tetap
// terbaca oleh pengguna buta warna maupun pembaca layar (WCAG 1.4.1).
const statusStyles: Record<VersionStatus, { symbol: string; className: string }> = {
  Sah: {
    symbol: "✓",
    className: "border-emerald-700 bg-emerald-50 text-emerald-800",
  },
  Digantikan: {
    symbol: "↺",
    className: "border-slate-500 bg-slate-100 text-slate-700",
  },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const { symbol, className } = statusStyles[status];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${className}`}
    >
      {/* Simbol hanya dekorasi; teks status sudah cukup untuk pembaca layar. */}
      <span aria-hidden="true">{symbol}</span>
      {status}
    </span>
  );
}
