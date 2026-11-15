import "server-only";
import { connection } from "next/server";
import type { HasilVerifikasi } from "@/lib/crypto/hasil-verifikasi";
import { verifikasiBerkas, type KandidatVersi } from "@/lib/crypto/verifikasi-pengesahan";
import { bacaKeyringDariEnv } from "@/lib/data/verifikasi-env";
import { todayInJakarta } from "@/lib/domain/tanggal";
import { muatKunciInduk } from "@/lib/integritas-versi";
import { getPrisma } from "@/lib/prisma";

/**
 * Pengelola DB tipis untuk verifikasi berkas (F-33): memuat kandidat (fileSha256 sama), baris
 * signing_keys, dan versi saudara untuk aturan F-03, lalu menyerahkan keputusan ke fungsi murni.
 * Galat operasional (keyring, kunci induk, DB) dilempar apa adanya; bukan hasil verifikasi.
 */
export async function verifikasiBerkasDenganDb(bytes: Uint8Array, sha256: string): Promise<HasilVerifikasi[]> {
  await connection();
  const prisma = getPrisma();
  const keyring = await bacaKeyringDariEnv();
  const kunciInduk = await muatKunciInduk();

  const baris = await prisma.version.findMany({
    where: { fileSha256: sha256 },
    include: { regulation: { select: { name: true } } },
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
  });
  const kandidat: KandidatVersi[] = baris.map(({ regulation, ...v }) => ({
    ...v,
    namaRegulasi: regulation.name,
  }));

  const idKunci = [...new Set(kandidat.flatMap((k) => (k.signingKeyId ? [k.signingKeyId] : [])))];
  const regulasiId = [...new Set(kandidat.map((k) => k.regulationId))];
  const [kunciDb, saudaraBaris] = await Promise.all([
    prisma.signingKey.findMany({ where: { id: { in: idKunci } } }),
    prisma.version.findMany({
      where: { regulationId: { in: regulasiId } },
      select: { id: true, regulationId: true, status: true, effectiveDate: true },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  return verifikasiBerkas({
    bytes,
    kandidat,
    kunciInduk,
    keyring,
    kunciDb,
    saudara: saudaraBaris.map((s) => ({ ...s, effectiveDate: s.effectiveDate.toISOString().slice(0, 10) })),
    hariIni: todayInJakarta(new Date()),
  });
}
