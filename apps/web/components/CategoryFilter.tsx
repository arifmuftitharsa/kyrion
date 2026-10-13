import Link from "next/link";
import { focusRing } from "@/lib/styles";

interface CategoryFilterProps {
  categories: string[];
  active?: string;
}

interface FilterOption {
  label: string;
  href: string;
  isActive: boolean;
}

// Filter memakai tautan biasa (?kategori=...) alih-alih state React, sehingga
// tetap Server Component, URL bisa dibagikan, dan berfungsi tanpa JavaScript.
function buildOptions(categories: string[], active?: string): FilterOption[] {
  return [
    { label: "Semua", href: "/", isActive: !active },
    ...categories.map((category) => ({
      label: category,
      href: `/?kategori=${encodeURIComponent(category)}`,
      isActive: category === active,
    })),
  ];
}

export default function CategoryFilter({ categories, active }: CategoryFilterProps) {
  const options = buildOptions(categories, active);

  return (
    <nav aria-label="Filter kategori">
      <ul className="flex flex-wrap gap-2">
        {options.map((option) => (
          <li key={option.label}>
            <Link
              href={option.href}
              aria-current={option.isActive ? "page" : undefined}
              className={`inline-block rounded-full border px-4 py-1.5 text-sm font-medium ${focusRing} ${
                option.isActive
                  ? "border-blue-800 bg-blue-800 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-blue-800 hover:text-blue-800"
              }`}
            >
              {option.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
