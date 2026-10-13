# AI_LOG

Log penggunaan AI dalam pengembangan produk Kyrion.

| tanggal | alat | tujuan | prompt ringkas | bagian kode terdampak | verifikasi |
|---|---|---|---|---|---|
| 2026-10-13 | Claude (chat, claude.ai) | Merancang struktur tiga halaman dan komponen; menjelaskan konsep TypeScript (union type, object type); menyusun prompt untuk Claude Code; meninjau laporan Lighthouse, tangkapan layar, dan README. | "bantu rancang dan jelaskan langkah Tugas 1 PAW" | Tidak ada kode dari chat yang ditempel ke repository. dikonfirmasi: seluruh kode berasal dari Claude Code. | Rancangan dicocokkan dengan PAW-03 Tugas 1.md dan PRD. |
| 2026-10-13 | Claude Code | Membuat antarmuka v0.1. | "buat 3 halaman, 7 komponen, data sintetis, validasi formulir, aksesibilitas, tanpa push dan tanpa trailer" | 4 commit (`30bf3f5`, `b16f615`, `5d504f4`, `2576466`): `apps/web/lib/` (`types.ts`, `format.ts`, `styles.ts`, `data/regulations.ts`, `validation/verify-form.ts`); `apps/web/components/` (`SiteHeader`, `StatusBadge`, `CategoryFilter`, `RegulationCard`, `VersionTimeline`, `VerifyResult`, `VerifyForm`); `apps/web/app/` (`layout.tsx`, `page.tsx`, `globals.css`, `regulasi/[slug]/page.tsx`, `verifikasi/page.tsx`). | `npx tsc --noEmit`, `npm run lint`, `npm run build`; uji manual formulir; Lighthouse Accessibility 100 di tiga halaman; pemeriksaan manual papan ketik dan zoom 200% di beranda (lihat `docs/tugas-1/lighthouse/KONDISI-UJI.md`). |
| 2026-10-13 | Claude Code | Menulis README.md dan AI_LOG.md. | "tulis README sesuai ketentuan Tugas 1" | `README.md`, `AI_LOG.md` | Tautan dan gambar diperiksa; isi dicocokkan dengan kode oleh Arif. |

## Yang saya ubah atau pelajari dari keluaran AI

**Yang saya pelajari dari kode:**
- Hanya `VerifyForm` yang memakai `"use client"`, karena hanya komponen itu yang butuh interaktivitas di browser (state input dan penanganan submit). Komponen lain tetap Server Component supaya JavaScript yang dikirim ke browser lebih sedikit.
- `params` dan `searchParams` harus di-`await` karena di Next.js versi terbaru keduanya bertipe Promise; tanpa `await`, nilainya belum bisa dipakai langsung.
- Di beranda, kartu tampil 1 kolom karena `grid` tanpa `grid-cols` hanya punya satu kolom. `md:grid-cols-2` aktif mulai 768 px dan `lg:grid-cols-3` mulai 1024 px. Di 1280 px syarat `md:` dan `lg:` sama-sama terpenuhi, dan `lg:` yang berlaku karena mobile-first memakai `min-width`.

**Yang saya ubah sendiri:** menambahkan `.claude/` ke `.gitignore` dan memperbaiki nama berkas screenshot. Belum ada perubahan lain pada kode keluaran Claude Code.
