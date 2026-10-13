import Link from "next/link";
import { focusRing } from "@/lib/styles";

const navItems = [
  { href: "/", label: "Daftar Regulasi" },
  { href: "/verifikasi", label: "Verifikasi Dokumen" },
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
          <ul className="flex flex-wrap gap-4">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`rounded font-medium text-slate-700 underline-offset-4 hover:text-blue-800 hover:underline ${focusRing}`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
