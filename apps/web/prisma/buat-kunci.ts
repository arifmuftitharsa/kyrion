// CLI sekali jalan: membuat berkas kunci induk integritas versi (F-31).
// Jalankan dari apps/web: npx tsx prisma/buat-kunci.ts
import { loadEnvConfig } from "@next/env";
import path from "node:path";
import { buatBerkasKunci } from "../lib/crypto/kunci";

loadEnvConfig(process.cwd());

// Akar repository: dua tingkat di atas apps/web (skrip dijalankan dari apps/web, seperti seed.ts).
const AKAR_REPOSITORY = path.resolve(process.cwd(), "..", "..");

/**
 * Apakah `lokasi` berada di dalam repository. path.relative sudah menormalkan pemisah
 * dan, di Windows, membandingkan tanpa peka huruf besar-kecil. Hasilnya path absolut
 * bila beda drive (jelas di luar); "..", atau berawalan ".." + pemisah, berarti di luar.
 * Awalan ".." saja tidak cukup: folder bernama "..data" di dalam repository bukan di luar.
 * shortcut: symlink dari luar ke dalam repository tidak terdeteksi, naikkan ke realpath bila perlu.
 */
function didalamRepository(lokasi: string): boolean {
  const relatif = path.relative(AKAR_REPOSITORY, lokasi);
  const diLuar = relatif === ".." || relatif.startsWith(`..${path.sep}`) || path.isAbsolute(relatif);
  return !diLuar;
}

function gagal(pesan: string): number {
  console.error(pesan);
  return 1;
}

async function main(): Promise<number> {
  const diatur = process.env.KYRION_MASTER_KEY_FILE?.trim();
  if (!diatur) {
    return gagal("KYRION_MASTER_KEY_FILE belum diisi di apps/web/.env.local.");
  }
  const lokasi = path.resolve(diatur);
  if (didalamRepository(lokasi)) {
    return gagal("Lokasi kunci berada di dalam repository. Pilih lokasi di luar repository agar kunci tidak ikut ter-commit.");
  }

  try {
    await buatBerkasKunci(lokasi);
  } catch (error) {
    const kode = (error as NodeJS.ErrnoException).code;
    // Berkas lama tidak pernah ditimpa: menimpa kunci membuat semua tag lama tidak bisa diverifikasi.
    if (kode === "EEXIST") {
      return gagal(`Berkas kunci sudah ada dan tidak ditimpa: ${lokasi}`);
    }
    // Hanya kode galat yang dicetak, bukan pesan lengkap.
    return gagal(`Berkas kunci gagal dibuat (kode: ${kode ?? "tidak diketahui"}): ${lokasi}`);
  }

  console.log(`Berkas kunci dibuat: ${lokasi}`);
  console.log("Segera buat cadangan berkas ini di tempat aman. Kunci hilang berarti semua unduhan versi berberkas ditolak.");
  return 0;
}

main()
  .then((kode) => {
    process.exitCode = kode;
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
