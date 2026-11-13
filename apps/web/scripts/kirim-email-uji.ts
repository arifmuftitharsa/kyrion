// CLI sekali jalan: bukti pengiriman nyata ke Mailtrap Sandbox.
// Jalankan dari apps/web: npx tsx --conditions=react-server scripts/kirim-email-uji.ts
// Flag --conditions=react-server dibutuhkan karena lib/email/index.ts memuat "server-only",
// yang melempar galat kecuali kondisi `react-server` aktif (pola sama dengan backfill integritas).
// PERINGATAN: tiap eksekusi mengirim satu pesan dan memakai kuota sandbox Mailtrap.
// Skrip hanya untuk EMAIL_ADAPTER=mailtrap dan tidak pernah mencetak isi email atau nilai env.
import { loadEnvConfig } from "@next/env";
import { getPengirimEmail } from "../lib/email/index";
import { GalatKonfigurasiEmail } from "../lib/email/konfigurasi";
import { GalatPengirimEmail } from "../lib/email/pengirim";

loadEnvConfig(process.cwd());

function gagal(pesan: string): number {
  console.error(pesan);
  return 1;
}

/** Satu baris yang aman dicetak: hanya nama kelas, alasan/status, atau nama variabel. */
function ringkasGalat(error: unknown): string {
  if (error instanceof GalatPengirimEmail) {
    return `${error.name}: ${error.alasan}${error.status === undefined ? "" : ` (HTTP ${error.status})`}`;
  }
  if (error instanceof GalatKonfigurasiEmail) {
    return `${error.name}: ${error.variabel.join(", ")}`;
  }
  return error instanceof Error ? error.name : "Galat tidak dikenal";
}

async function main(): Promise<number> {
  if (process.env.NODE_ENV === "production") {
    return gagal("Ditolak: skrip ini tidak boleh berjalan dengan NODE_ENV=production.");
  }
  if (process.env.EMAIL_ADAPTER !== "mailtrap") {
    return gagal('Ditolak: skrip ini hanya untuk EMAIL_ADAPTER="mailtrap".');
  }

  try {
    await getPengirimEmail().kirim({
      penerima: "uji@example.com",
      subjek: "Uji pengiriman Kyrion",
      teks: `Uji sekali jalan. Waktu: ${new Date().toISOString()}`,
    });
  } catch (error) {
    return gagal(ringkasGalat(error));
  }

  console.log("Terkirim ke sandbox Mailtrap.");
  return 0;
}

main()
  .then((kode) => {
    process.exitCode = kode;
  })
  .catch((error: unknown) => {
    console.error(ringkasGalat(error));
    process.exitCode = 1;
  });
