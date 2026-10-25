import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Satu instance per proses; disimpan di globalThis agar hot reload saat dev
// tidak membuat pool koneksi baru setiap kali modul dimuat ulang.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL belum diatur.");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** Dibuat saat query pertama, bukan saat import, agar build tidak butuh env/DB. */
export function getPrisma(): PrismaClient {
  globalForPrisma.prisma ??= createPrismaClient();
  return globalForPrisma.prisma;
}
