import "server-only";
import type { UserRole } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

// Repositori akun. Tanpa connection(): dipanggil dari Server Action dan dari
// wajibAdmin(), yang sudah dinamis karena membaca cookie.

export interface LoginCandidate {
  id: string;
  role: UserRole;
  isActive: boolean;
  passwordHash: string | null;
}

/** Data untuk verifikasi login; email harus sudah dinormalisasi huruf kecil. */
export async function findUserForLogin(email: string): Promise<LoginCandidate | undefined> {
  const row = await getPrisma().user.findUnique({
    select: { id: true, role: true, isActive: true, passwordHash: true },
    where: { email },
  });
  return row ?? undefined;
}

/** Admin aktif berdasarkan id sesi; sumber kebenaran peran dan status akun. */
export async function findActiveAdminById(
  id: string,
): Promise<{ id: string; email: string } | undefined> {
  const row = await getPrisma().user.findFirst({
    select: { id: true, email: true },
    where: { id, isActive: true, role: "ADMIN" },
  });
  return row ?? undefined;
}
