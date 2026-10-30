// DEMO SEMENTARA: bukti rollback transaksi untuk Dokumen Teknis Modul 6.
import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../generated/prisma/client";

loadEnvConfig(process.cwd());

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// UUID yang tidak ada di tabel versions, agar perintah kedua melanggar foreign key.
const VERSI_TIDAK_ADA = "00000000-0000-0000-0000-000000000000";

async function main() {
  const versi = await prisma.version.findFirst({
    where: { versionNumber: "2025/2026", regulation: { slug: "pedoman-akademik" } },
    select: { id: true },
  });
  if (!versi) throw new Error("Versi sasaran tidak ditemukan");

  const hitungChange = () => prisma.change.count({ where: { versionId: versi.id } });

  console.log("Jumlah Change sebelum:", await hitungChange());

  try {
    await prisma.$transaction([
      prisma.change.deleteMany({ where: { versionId: versi.id } }),
      prisma.change.create({
        data: {
          versionId: VERSI_TIDAK_ADA,
          description: "Butir uji yang sengaja gagal",
          source: "CHANGELOG",
        },
      }),
    ]);
    console.log("Transaksi berhasil (tidak diharapkan)");
  } catch (error) {
    const kode = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "bukan galat Prisma";
    console.log("Transaksi gagal, kode galat:", kode);
  }

  console.log("Jumlah Change sesudah:", await hitungChange());
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());