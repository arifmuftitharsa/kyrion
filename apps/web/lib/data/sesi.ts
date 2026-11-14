import "server-only";
import { getPrisma } from "@/lib/prisma";

// Repositori sesi milik pengguna. Token, ipAddress, dan userAgent sengaja tidak pernah dipilih.

export interface BarisSesi {
  id: string;
  createdAt: Date;
  expiresAt: Date;
}

/** Sesi aktif (belum kedaluwarsa) milik userId, terbaru dulu. */
export async function daftarSesiAktif(userId: string, sekarang: Date): Promise<BarisSesi[]> {
  return getPrisma().session.findMany({
    select: { id: true, createdAt: true, expiresAt: true },
    where: { userId, expiresAt: { gt: sekarang } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}

/**
 * Pemilik (userId) ada di where penghapusan itu sendiri: sesi orang lain tidak pernah
 * terhapus. false = tidak ada sesi dengan id itu milik userId.
 */
export async function cabutSesi(id: string, userId: string): Promise<boolean> {
  const { count } = await getPrisma().session.deleteMany({ where: { id, userId } });
  return count > 0;
}
