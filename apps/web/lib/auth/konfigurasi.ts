// Konfigurasi Better Auth. Fungsi murni: env disuntik sebagai parameter. Pesan galat
// hanya menyebut NAMA variabel, tidak pernah nilainya.
import { z } from "zod";

export const skemaEnvAuth = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url({ protocol: /^https?$/ }),
});

export type EnvAuth = Readonly<Record<string, string | undefined>>;
export type KonfigurasiAuth = z.infer<typeof skemaEnvAuth>;

export class GalatKonfigurasiAuth extends Error {
  constructor(readonly variabel: readonly string[]) {
    super(`Konfigurasi auth tidak valid, periksa variabel: ${variabel.join(", ")}`);
    this.name = "GalatKonfigurasiAuth";
  }
}

export function bacaKonfigurasiAuth(env: EnvAuth): KonfigurasiAuth {
  const hasil = skemaEnvAuth.safeParse(env);
  if (!hasil.success) {
    throw new GalatKonfigurasiAuth([...new Set(hasil.error.issues.map((i) => String(i.path[0])))]);
  }
  return hasil.data;
}
