// Berkas ini memutuskan HAK PERAN atas halaman dan rute buatan kita. Berbeda dari
// lib/auth/izin.ts, yang hanya allowlist endpoint Better Auth yang boleh dipanggil lewat
// HTTP. Keduanya tidak saling memanggil. Fungsi murni: tanpa Next, Better Auth, atau Prisma.

export type Syarat = "masuk" | "admin";
export type Keputusan = "izinkan" | "masuk" | "tolak";

/** Deny by default: peran selain ADMIN/SIVITAS (termasuk yang tak dikenal) ditolak. */
export function putuskanAkses(sesi: { role: string } | null, syarat: Syarat): Keputusan {
  if (sesi === null) return "masuk";
  if (sesi.role === "ADMIN") return "izinkan";
  if (sesi.role === "SIVITAS" && syarat === "masuk") return "izinkan";
  return "tolak";
}
