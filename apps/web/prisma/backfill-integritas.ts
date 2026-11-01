// CLI idempoten: menandatangani versi berberkas yang belum bertag integritas (F-31).
//
// Jalankan dari apps/web, dengan flag di bawah:
//   npx tsx --conditions=react-server prisma/backfill-integritas.ts
//
// Kenapa --conditions=react-server: lib/penyimpanan.ts (pembaca berkas storage) memuat
// "server-only", yang melempar galat kecuali kondisi `react-server` aktif. Penjaga itu
// melindungi bundel klien Next.js dan tidak relevan di skrip CLI; flag ini membuat
// paket server-only menunjuk ke berkas kosong, sehingga logika baca storage dan aturan
// path-nya dipakai apa adanya tanpa disalin ke skrip. Flag hanya untuk skrip CLI ini.
import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { dataTerlindungDariBaris } from "../lib/crypto/data-terlindung";
import { verifyFingerprint } from "../lib/crypto/fingerprint";
import { KunciTidakValid, bacaKunciInduk } from "../lib/crypto/kunci";
import { buatTagVersi } from "../lib/crypto/mac";

loadEnvConfig(process.cwd());

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main(): Promise<number> {
  // Dinamis dan setelah loadEnvConfig: ROOT penyimpanan dihitung saat modul diimpor
  // dan membaca KYRION_STORAGE_DIR.
  const { bacaBerkas } = await import("../lib/penyimpanan");
  const kunciInduk = await bacaKunciInduk(process.env.KYRION_MASTER_KEY_FILE);

  // Hanya baris berberkas lengkap yang belum bertag; menjalankan ulang aman (idempoten).
  const versi = await prisma.version.findMany({
    where: {
      integrityTag: null,
      fileKey: { not: null },
      fileName: { not: null },
      fileSize: { not: null },
      fileSha256: { not: null },
    },
    select: {
      id: true,
      regulationId: true,
      versionNumber: true,
      effectiveDate: true,
      fileKey: true,
      fileName: true,
      fileSize: true,
      fileSha256: true,
    },
    orderBy: { createdAt: "asc" },
  });

  let ditandatangani = 0;
  let hashTidakCocok = 0;
  let berkasHilang = 0;
  let sudahBertag = 0;

  for (const baris of versi) {
    const data = dataTerlindungDariBaris(baris);
    if (!data || !baris.fileKey) throw new Error(`Baris ${baris.id} tidak lengkap meski lolos filter.`);

    let bytes: Buffer;
    try {
      bytes = await bacaBerkas(baris.fileKey);
    } catch {
      console.warn(`DILEWATI (berkas hilang atau tidak terbaca): versi ${baris.id}`);
      berkasHilang++;
      continue;
    }

    // Berkas dibandingkan dengan hash di DB lebih dulu: tag tidak boleh mengesahkan
    // data yang sudah berubah sebelum backfill dijalankan.
    let cocok: boolean;
    try {
      cocok = verifyFingerprint(bytes, data.fileSha256);
    } catch {
      // InputTooLargeError: berkas di disk melewati batas, jelas tidak cocok.
      cocok = false;
    }
    if (!cocok) {
      console.warn(`DILEWATI (hash berkas tidak cocok dengan DB): versi ${baris.id}`);
      hashTidakCocok++;
      continue;
    }

    // Tidak pernah menimpa tag: bila sudah terisi sejak query (mis. disimpan aplikasi), count = 0.
    const { count } = await prisma.version.updateMany({
      where: { id: baris.id, integrityTag: null },
      data: { integrityTag: buatTagVersi(kunciInduk, data) },
    });
    if (count === 1) ditandatangani++;
    else sudahBertag++;
  }

  console.log(`Backfill selesai: ${versi.length} versi diperiksa.`);
  console.log(`  ditandatangani                  : ${ditandatangani}`);
  console.log(`  dilewati (hash tidak cocok)     : ${hashTidakCocok}`);
  console.log(`  dilewati (berkas hilang)        : ${berkasHilang}`);
  console.log(`  dilewati (sudah bertag)         : ${sudahBertag}`);
  // Kode 2: ada versi yang berkasnya berbeda dari catatan DB dan perlu diselidiki.
  return hashTidakCocok > 0 ? 2 : 0;
}

main()
  .then((kode) => {
    process.exitCode = kode;
  })
  .catch((error: unknown) => {
    // Tanpa stack. Pesan hanya dicetak untuk KunciTidakValid (alasan tetap, bukan isi kunci);
    // galat lain (mis. Prisma) hanya namanya, karena pesannya bisa memuat detail koneksi atau query.
    const ringkas =
      error instanceof KunciTidakValid ? error.message : error instanceof Error ? error.name : "galat tidak dikenal";
    console.error("Backfill gagal:", ringkas);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
