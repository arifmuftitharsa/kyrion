import { z } from "zod";
import { GalatPengirimEmail, type PengirimEmail } from "./pengirim";

export const USER_AGENT_KYRION = "kyrion-web/0.3";
export const BATAS_WAKTU_BAWAAN_MS = 5000;

export interface OpsiMailtrap {
  token: string;
  sandboxId: number;
  from: { email: string; name: string };
  fetch: typeof fetch;
  batasWaktuMs?: number;
}

const skemaSukses = z.object({
  success: z.literal(true),
  message_ids: z.array(z.string()).min(1),
});

/**
 * Mailtrap Email Sandbox (POST /api/send/{sandboxId}). Galat hanya membawa
 * alasan dan status; isi respons, token, dan data pesan tidak pernah disalin.
 */
export function buatPengirimMailtrap(opsi: OpsiMailtrap): PengirimEmail {
  if (!Number.isSafeInteger(opsi.sandboxId) || opsi.sandboxId <= 0) {
    throw new RangeError("sandboxId harus bilangan bulat positif");
  }
  const url = `https://sandbox.api.mailtrap.io/api/send/${opsi.sandboxId}`;
  const batasWaktuMs = opsi.batasWaktuMs ?? BATAS_WAKTU_BAWAAN_MS;

  return {
    async kirim(pesan) {
      const signal = AbortSignal.timeout(batasWaktuMs);
      let respons: Response;
      try {
        respons = await opsi.fetch(url, {
          method: "POST",
          headers: {
            "Api-Token": opsi.token,
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": USER_AGENT_KYRION,
          },
          body: JSON.stringify({
            from: { email: opsi.from.email, name: opsi.from.name },
            to: [{ email: pesan.penerima }],
            subject: pesan.subjek,
            text: pesan.teks,
          }),
          signal,
          // Cegah header Api-Token terbawa ke host lain lewat redirect.
          redirect: "error",
        });
      } catch {
        throw new GalatPengirimEmail(signal.aborted ? "WAKTU_HABIS" : "JARINGAN");
      }

      const { status } = respons;
      if (status === 401) throw new GalatPengirimEmail("TOKEN_DITOLAK", status);
      if (status === 429) throw new GalatPengirimEmail("KUOTA_ATAU_LAJU", status);
      if (status < 200 || status >= 300) throw new GalatPengirimEmail("STATUS_GAGAL", status);

      let badan: unknown;
      try {
        badan = await respons.json();
      } catch {
        if (signal.aborted) throw new GalatPengirimEmail("WAKTU_HABIS");
        throw new GalatPengirimEmail("RESPONS_TIDAK_SESUAI", status);
      }
      if (status !== 200 || !skemaSukses.safeParse(badan).success) {
        throw new GalatPengirimEmail("RESPONS_TIDAK_SESUAI", status);
      }
    },
  };
}
