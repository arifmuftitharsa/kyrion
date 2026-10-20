"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { focusRing } from "@/lib/styles";

export type Tautan = { href: string; label: string };

export default function TautanNav({ tautan }: { tautan: Tautan[] }) {
  const pathname = usePathname();

  return (
    <ul className="flex flex-wrap gap-4">
      {tautan.map((t) => {
        // "/" hanya aktif bila persis sama; tautan lain cocok per awalan.
        const aktif =
          t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);

        return (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={aktif ? "page" : undefined}
              className={`rounded font-medium underline-offset-4 hover:text-blue-800 hover:underline ${
                aktif ? "text-blue-800 underline" : "text-slate-700"
              } ${focusRing}`}
            >
              {t.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}