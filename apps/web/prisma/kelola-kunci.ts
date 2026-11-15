// CLI operator kunci penandatangan (F-32, F-33): buat, putar, cabut.
//
// Jalankan dari apps/web (jalur contoh di luar repository):
//   npx tsx prisma/kelola-kunci.ts buat  --out C:\kyrion-keys\kunci-1.pem
//   npx tsx prisma/kelola-kunci.ts putar --out C:\kyrion-keys\kunci-2.pem
//   npx tsx prisma/kelola-kunci.ts cabut --id <32 hex>
//
// Lokasi keyring dibaca dari KYRION_KEYRING_FILE. Logika ada di lib/crypto/operasi-kunci.ts.
import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { existsSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { PrismaClient } from "../generated/prisma/client";
import { KeyringTidakValid } from "../lib/crypto/keyring";
import {
  KeadaanTidakPasti,
  OperasiKunciGagal,
  buatKunci,
  cabutKunciOperator,
  putarKunciOperator,
  type Konteks,
} from "../lib/crypto/operasi-kunci";

loadEnvConfig(process.cwd());

// Akar repository: dua tingkat di atas apps/web (skrip dijalankan dari apps/web, seperti seed.ts).
const AKAR_REPOSITORY = path.resolve(process.cwd(), "..", "..");

const PENGINGAT_ACL =
  "Di Windows mode 0o600 tidak ditegakkan; simpan berkas privat di folder dengan ACL terbatas.";

const PEMULIHAN_MANUAL = [
  "Pemulihan manual:",
  "  1. Periksa isi tabel signing_keys (id, status, rotated_at, revoked_at) di basis data.",
  "  2. Bandingkan dengan berkas keyring (id dan status harus sama persis).",
  "  3. Bila berbeda, samakan KEYRING ke keadaan basis data dari salinan cadangan keyring",
  "     (hanya kunci publik, aman dicadangkan), atau samakan basis data ke keyring; jangan keduanya.",
  "  4. Selama belum cocok, verifikasi menolak (gagal tertutup). Berkas privat baru tidak dihapus.",
];

function gagal(pesan: string): number {
  console.error(pesan);
  return 1;
}

async function main(prisma: PrismaClient): Promise<number> {
  let argumen: ReturnType<typeof bacaArgumen>;
  try {
    argumen = bacaArgumen();
  } catch {
    return gagal("Pemakaian: kelola-kunci.ts buat --out <berkas> | putar --out <berkas> | cabut --id <id>");
  }
  const { perintah, out, id } = argumen;

  // Akar dihitung dari cwd; bila bukan akar repository, cek "di luar repo" akan salah.
  if (!existsSync(path.join(AKAR_REPOSITORY, ".git"))) {
    return gagal("Jalankan dari apps/web; akar repository tidak ditemukan.");
  }

  const diatur = process.env.KYRION_KEYRING_FILE?.trim();
  if (!diatur) return gagal("KYRION_KEYRING_FILE belum diisi di apps/web/.env.local.");

  const konteks: Konteks = {
    // PrismaClient memenuhi KlienKunci secara struktural; tipe transaksi Prisma lebih lebar.
    db: prisma as unknown as Konteks["db"],
    berkasKeyring: path.resolve(diatur),
    akarRepo: AKAR_REPOSITORY,
    jam: () => new Date(),
  };

  if (perintah === "buat") {
    const h = await buatKunci(konteks, { out });
    console.log(`Kunci dibuat: id ${h.id}, status ${h.status}`);
    console.log(`Berkas privat: ${h.out}`);
    console.log(`Atur KYRION_SIGNING_KEY_FILE ke berkas privat di atas. ${PENGINGAT_ACL}`);
  } else if (perintah === "putar") {
    const h = await putarKunciOperator(konteks, { out });
    console.log(`Kunci diputar: id lama ${h.idLama} (dirotasi), id baru ${h.id} (${h.status})`);
    console.log(`Berkas privat baru: ${h.out}`);
    console.log(`PENGINGAT: arahkan KYRION_SIGNING_KEY_FILE ke berkas baru. ${PENGINGAT_ACL}`);
  } else {
    const h = await cabutKunciOperator(konteks, { id });
    console.log(`Kunci dicabut: id ${h.id}, status ${h.status}`);
    if (!h.adaKunciAktifTersisa) {
      console.warn("PERINGATAN: tidak ada kunci aktif tersisa; penandatanganan gagal tertutup sampai kunci baru dibuat (perintah buat).");
    }
    console.log("Tanda tangan lama dari kunci yang dicabut ditolak selamanya (re-sign ditunda ke v1.0).");
  }
  return 0;
}

function bacaArgumen(): { perintah: "buat" | "putar" | "cabut"; out: string; id: string } {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { out: { type: "string" }, id: { type: "string" } },
  });
  const [perintah, ...sisa] = positionals;
  if (sisa.length > 0) throw new Error("argumen berlebih");
  if ((perintah === "buat" || perintah === "putar") && values.out && !values.id) {
    return { perintah, out: values.out, id: "" };
  }
  if (perintah === "cabut" && values.id && !values.out) return { perintah, out: "", id: values.id };
  throw new Error("argumen tidak valid");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

main(prisma)
  .then((kode) => {
    process.exitCode = kode;
  })
  .catch((error: unknown) => {
    // Tanpa stack. Pesan hanya untuk galat dengan alasan tetap; galat lain (mis. Prisma)
    // hanya namanya, karena pesannya bisa memuat detail koneksi atau query.
    if (error instanceof KeadaanTidakPasti) {
      console.error(error.message);
      for (const baris of PEMULIHAN_MANUAL) console.error(baris);
    } else if (error instanceof OperasiKunciGagal || error instanceof KeyringTidakValid) {
      console.error(error.message);
    } else {
      console.error("Operasi gagal:", error instanceof Error ? error.name : "galat tidak dikenal");
    }
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
