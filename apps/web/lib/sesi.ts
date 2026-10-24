import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

type Sesi = { email: string; kedaluwarsa: number };

const DELAPAN_JAM = 60 * 60 * 8; // dalam detik

// Penyimpanan sesi sementara di memori server; diganti pustaka autentikasi di Modul 10.
// Diletakkan di globalThis agar tidak hilang setiap kali Fast Refresh memuat ulang modul.
const g = globalThis as unknown as { sesiTiruan?: Map<string, Sesi> };
const penyimpanan = (g.sesiTiruan ??= new Map<string, Sesi>());

export async function buatSesi(email: string) {
  const id = crypto.randomUUID();
  penyimpanan.set(id, { email, kedaluwarsa: Date.now() + DELAPAN_JAM * 1000 });
  (await cookies()).set("sesi", id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DELAPAN_JAM,
  });
}

export async function bacaSesi() {
  const id = (await cookies()).get("sesi")?.value;
  const sesi = id ? penyimpanan.get(id) : undefined;
  if (!sesi || sesi.kedaluwarsa < Date.now()) return null;
  return sesi;
}

/**
 * Wajib di setiap halaman admin dan Server Action (endpoint publik), bukan
 * hanya di proxy.ts. Panggil di luar try/catch: redirect() bekerja dengan melempar.
 */
export async function wajibAdmin(): Promise<Sesi> {
  const sesi = await bacaSesi();
  if (!sesi) redirect("/masuk");
  return sesi;
}

export async function hapusSesi() {
  const toko = await cookies();
  const id = toko.get("sesi")?.value;
  if (id) penyimpanan.delete(id);
  toko.delete("sesi");
}