import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SiteHeader from "@/components/SiteHeader";
import { focusRing } from "@/lib/styles";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kyrion",
  description:
    "Daftar regulasi kampus, riwayat versi, dan verifikasi dokumen (v0.1, data tiruan).",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // lang="id" agar pembaca layar melafalkan teks dengan aturan Bahasa Indonesia.
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900">
        {/* Skip link: pengguna keyboard bisa melompati navigasi langsung ke konten. */}
        <a
          href="#konten"
          className={`sr-only rounded bg-white px-4 py-2 font-medium text-blue-800 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 ${focusRing}`}
        >
          Lewati ke konten utama
        </a>
        <SiteHeader />
        <main id="konten" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
