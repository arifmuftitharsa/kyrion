// Pemilih adapter email dari konfigurasi. Fungsi murni: env disuntik sebagai
// parameter (tidak membaca process.env) dan gagal tertutup. Pesan galat hanya
// menyebut NAMA variabel, tidak pernah nilainya.
import { z } from "zod";
import { buatPengirimKonsol } from "./konsol";
import { buatPengirimMailtrap } from "./mailtrap";
import { buatPengirimMemori } from "./memori";
import { bolehMemoriDanKonsol, type PengirimEmail } from "./pengirim";

export const NAMA_PENGIRIM = "Kyrion";

export const skemaEnvEmail = z.object({
  EMAIL_ADAPTER: z.enum(["memori", "konsol", "mailtrap"]),
  EMAIL_FROM: z.email(),
  MAILTRAP_API_TOKEN: z.string().min(1),
  // Bilangan bulat positif pada string desimal; batas 15 digit menjaga angka tetap aman.
  MAILTRAP_SANDBOX_ID: z.string().regex(/^[1-9]\d{0,14}$/).transform(Number),
  NODE_ENV: z.string(),
});

export type EnvEmail = Readonly<Record<string, string | undefined>>;

export class GalatKonfigurasiEmail extends Error {
  constructor(readonly variabel: readonly string[]) {
    super(`Konfigurasi email tidak valid, periksa variabel: ${variabel.join(", ")}`);
    this.name = "GalatKonfigurasiEmail";
  }
}

export interface DepsPengirim {
  fetch: typeof fetch;
  batasWaktuMs?: number;
}

export function buatPengirim(env: EnvEmail, deps: DepsPengirim): PengirimEmail {
  const adapter = skemaEnvEmail.shape.EMAIL_ADAPTER.safeParse(env.EMAIL_ADAPTER);
  if (!adapter.success) throw new GalatKonfigurasiEmail(["EMAIL_ADAPTER"]);

  if (adapter.data === "mailtrap") {
    const cfg = skemaEnvEmail
      .pick({ EMAIL_FROM: true, MAILTRAP_API_TOKEN: true, MAILTRAP_SANDBOX_ID: true })
      .safeParse(env);
    if (!cfg.success) {
      const nama = new Set(cfg.error.issues.map((i) => String(i.path[0])));
      throw new GalatKonfigurasiEmail([...nama]);
    }
    return buatPengirimMailtrap({
      token: cfg.data.MAILTRAP_API_TOKEN,
      sandboxId: cfg.data.MAILTRAP_SANDBOX_ID,
      from: { email: cfg.data.EMAIL_FROM, name: NAMA_PENGIRIM },
      fetch: deps.fetch,
      batasWaktuMs: deps.batasWaktuMs,
    });
  }

  if (!bolehMemoriDanKonsol(env.NODE_ENV)) {
    throw new GalatKonfigurasiEmail(["EMAIL_ADAPTER", "NODE_ENV"]);
  }
  return adapter.data === "memori" ? buatPengirimMemori() : buatPengirimKonsol(env.NODE_ENV);
}
