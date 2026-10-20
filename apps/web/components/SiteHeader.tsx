import { Suspense } from "react";
import Link from "next/link";
import TautanNav, { type Tautan } from "@/components/TautanNav";
import { focusRing } from "@/lib/styles";

const navItems: Tautan[] = [
  { href: "/", label: "Daftar Regulasi" },
  { href: "/verifikasi", label: "Verifikasi Dokumen" },
  { href: "/masuk", label: "Masuk" },
];

export default function SiteHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/"
          className={`rounded text-xl font-bold text-slate-900 ${focusRing}`}
        >
          Kyrion
        </Link>
        {/* aria-label membedakan navigasi utama dari <nav> lain (mis. filter kategori). */}
        <nav aria-label="Navigasi utama">
          <Suspense fallback={<TautanPolos tautan={navItems} />}>
            <TautanNav tautan={navItems} />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}

// Fallback: tautan yang sama tanpa penanda halaman aktif.
function TautanPolos({ tautan }: { tautan: Tautan[] }) {
  return (
    <ul className="flex flex-wrap gap-4">
      {tautan.map((t) => (
        <li key={t.href}>
          <Link
            href={t.href}
            className={`rounded font-medium text-slate-700 underline-offset-4 hover:text-blue-800 hover:underline ${focusRing}`}
          >
            {t.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}