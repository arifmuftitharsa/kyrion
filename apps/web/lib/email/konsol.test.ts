import { describe, expect, it, vi } from "vitest";
import { buatPengirimKonsol } from "./konsol";
import { GalatPengirimEmail } from "./pengirim";

const pesan = { penerima: "a@contoh.test", subjek: "Kode masuk", teks: "OTP 123456" };

describe("buatPengirimKonsol", () => {
  it.each(["production", "", undefined, "staging"])(
    "menolak TIDAK_DIIZINKAN dan tidak mencetak saat NODE_ENV=%j",
    async (env) => {
      const cetak = vi.fn();
      const galat = await buatPengirimKonsol(env, cetak).kirim(pesan).catch((e: unknown) => e);
      expect(galat).toBeInstanceOf(GalatPengirimEmail);
      expect((galat as GalatPengirimEmail).alasan).toBe("TIDAK_DIIZINKAN");
      expect(cetak).not.toHaveBeenCalled();
    },
  );

  it.each(["development", "test"])("mencetak pesan saat NODE_ENV=%s", async (env) => {
    const cetak = vi.fn();
    await expect(buatPengirimKonsol(env, cetak).kirim(pesan)).resolves.toBeUndefined();
    expect(cetak).toHaveBeenCalledTimes(1);
    const keluaran = cetak.mock.calls[0][0] as string;
    expect(keluaran).toContain(pesan.penerima);
    expect(keluaran).toContain(pesan.subjek);
    expect(keluaran).toContain(pesan.teks);
  });
});
