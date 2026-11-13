import "server-only";
import type { UserRole } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

// Repositori akun. Tanpa connection(): dipanggil dari Server Action dan dari
// wajibAdmin(), yang sudah dinamis karena membaca cookie.

/** Akun aktif (peran apa pun) berdasarkan id sesi; sumber kebenaran peran dan status. */
export async function findActiveUserById(
  id: string,
): Promise<{ id: string; email: string; role: UserRole } | undefined> {
  const row = await getPrisma().user.findFirst({
    select: { id: true, email: true, role: true },
    where: { id, isActive: true },
  });
  return row ?? undefined;
}
