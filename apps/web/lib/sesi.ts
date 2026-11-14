import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { type Syarat, putuskanAkses } from "@/lib/akses/keputusan";
import { getAuth } from "@/lib/auth";
import { findActiveUserById } from "@/lib/data/users";

export type SesiPengguna = { userId: string; sesiId: string; email: string; role: "ADMIN" | "SIVITAS" };

/**
 * Sesi Better Auth dari cookie. Peran di sesi hanya petunjuk: peran dan status aktif
 * dibaca ulang dari tabel users di setiap pemanggilan; akun nonaktif atau hilang = tidak masuk.
 * cache() hanya mendedup dalam SATU render pass (header, layout, halaman); di Server Action dan
 * Route Handler tidak berefek. Keputusan akses tetap dibaca ulang dari DB di setiap request.
 */
export const bacaSesi = cache(async (): Promise<SesiPengguna | null> => {
  const sesi = await getAuth().api.getSession({ headers: await headers() });
  if (!sesi) return null;
  const pengguna = await findActiveUserById(sesi.user.id);
  if (!pengguna) return null;
  return { userId: pengguna.id, sesiId: sesi.session.id, email: pengguna.email, role: pengguna.role };
});

// Satu-satunya tempat keputusan akses halaman diterjemahkan ke efek Next. Panggil di luar
// try/catch: redirect() dan notFound() bekerja dengan melempar.
async function jagaHalaman(syarat: Syarat): Promise<SesiPengguna> {
  const sesi = await bacaSesi();
  const keputusan = putuskanAkses(sesi, syarat);
  if (keputusan === "masuk") redirect("/masuk");
  if (keputusan === "tolak") notFound();
  if (!sesi) redirect("/masuk"); // tak tercapai: hanya penyempit tipe
  return sesi;
}

/** Wajib masuk (ADMIN atau SIVITAS): anonim dialihkan ke /masuk, peran lain 404. */
export function wajibMasuk(): Promise<SesiPengguna> {
  return jagaHalaman("masuk");
}

/**
 * Wajib di setiap halaman admin dan Server Action (endpoint publik), bukan
 * hanya di proxy.ts. Anonim dialihkan ke /masuk (redirect), Sivitas dijawab 404 (notFound).
 * Status aktif dan peran dicek ulang di DB setiap permintaan, sehingga
 * akun yang dinonaktifkan langsung kehilangan akses meski sesinya masih hidup.
 */
export async function wajibAdmin(): Promise<{ id: string; email: string }> {
  const { userId, email } = await jagaHalaman("admin");
  return { id: userId, email };
}
