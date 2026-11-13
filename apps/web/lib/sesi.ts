import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { findActiveUserById } from "@/lib/data/users";

export type SesiPengguna = { userId: string; email: string; role: "ADMIN" | "SIVITAS" };

/**
 * Sesi Better Auth dari cookie. Peran di sesi hanya petunjuk: peran dan status aktif
 * dibaca ulang dari tabel users di setiap pemanggilan; akun nonaktif atau hilang = tidak masuk.
 */
export async function bacaSesi(): Promise<SesiPengguna | null> {
  const sesi = await getAuth().api.getSession({ headers: await headers() });
  if (!sesi) return null;
  const pengguna = await findActiveUserById(sesi.user.id);
  if (!pengguna) return null;
  return { userId: pengguna.id, email: pengguna.email, role: pengguna.role };
}

/**
 * Wajib di setiap halaman admin dan Server Action (endpoint publik), bukan
 * hanya di proxy.ts. Panggil di luar try/catch: redirect() bekerja dengan melempar.
 * Status aktif dan peran ADMIN dicek ulang di DB setiap permintaan, sehingga
 * akun yang dinonaktifkan langsung kehilangan akses meski sesinya masih hidup.
 */
export async function wajibAdmin(): Promise<{ id: string; email: string }> {
  const sesi = await bacaSesi();
  if (sesi?.role !== "ADMIN") redirect("/masuk");
  return { id: sesi.userId, email: sesi.email };
}
