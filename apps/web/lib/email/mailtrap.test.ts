import { afterEach, describe, expect, it, vi } from "vitest";
import { buatPengirimMailtrap, USER_AGENT_KYRION } from "./mailtrap";
import { GalatPengirimEmail, type AlasanGalatEmail } from "./pengirim";

const TOKEN = "token-rahasia-uji-7781";
const pesan = { penerima: "penerima.rahasia@contoh.test", subjek: "Subjek rahasia", teks: "OTP 482913" };
const from = { email: "kyrion@contoh.test", name: "Kyrion" };
const SUKSES = { success: true, message_ids: ["m-1"] };

const json = (badan: unknown, status = 200) => new Response(JSON.stringify(badan), { status });

function buat(fetchTiruan: typeof fetch, batasWaktuMs?: number) {
  return buatPengirimMailtrap({ token: TOKEN, sandboxId: 4321, from, fetch: fetchTiruan, batasWaktuMs });
}

async function galatDari(p: Promise<void>): Promise<GalatPengirimEmail> {
  const galat = await p.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(galat).toBeInstanceOf(GalatPengirimEmail);
  return galat as GalatPengirimEmail;
}

afterEach(() => vi.restoreAllMocks());

describe("buatPengirimMailtrap: permintaan", () => {
  it("mengirim URL, metode, header, isi JSON, signal, dan redirect sesuai spesifikasi", async () => {
    const fetchTiruan = vi.fn().mockResolvedValue(json(SUKSES));
    await expect(buat(fetchTiruan).kirim(pesan)).resolves.toBeUndefined();

    expect(fetchTiruan).toHaveBeenCalledTimes(1);
    const [url, init] = fetchTiruan.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://sandbox.api.mailtrap.io/api/send/4321");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      "Api-Token": TOKEN,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": USER_AGENT_KYRION,
    });
    expect(USER_AGENT_KYRION).toBe("kyrion-web/0.3");
    expect(JSON.parse(init.body as string)).toEqual({
      from,
      to: [{ email: pesan.penerima }],
      subject: pesan.subjek,
      text: pesan.teks,
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.redirect).toBe("error");
  });

  it.each([0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 2])(
    "menolak sandboxId %s dengan RangeError tanpa memuat nilainya",
    (sandboxId) => {
      const buatSalah = () => buatPengirimMailtrap({ token: TOKEN, sandboxId, from, fetch: vi.fn() });
      expect(buatSalah).toThrow(RangeError);
      expect(buatSalah).toThrow(/^sandboxId harus bilangan bulat positif$/);
    },
  );
});

describe("buatPengirimMailtrap: pemetaan hasil", () => {
  it.each<[number, AlasanGalatEmail]>([
    [401, "TOKEN_DITOLAK"],
    [429, "KUOTA_ATAU_LAJU"],
    [500, "STATUS_GAGAL"],
    [400, "STATUS_GAGAL"],
  ])("status %i menjadi %s dengan status terbawa", async (status, alasan) => {
    const galat = await galatDari(buat(vi.fn().mockResolvedValue(json({ success: false, errors: ["x"] }, status))).kirim(pesan));
    expect(galat.alasan).toBe(alasan);
    expect(galat.status).toBe(status);
  });

  it.each([
    ["success false", json({ success: false, message_ids: ["m"] })],
    ["message_ids kosong", json({ success: true, message_ids: [] })],
    ["message_ids bukan string", json({ success: true, message_ids: [1] })],
    ["JSON rusak", new Response("bukan json", { status: 200 })],
    ["2xx bukan 200", json(SUKSES, 201)],
  ])("200 berbentuk salah (%s) menjadi RESPONS_TIDAK_SESUAI", async (_nama, respons) => {
    const galat = await galatDari(buat(vi.fn().mockResolvedValue(respons)).kirim(pesan));
    expect(galat.alasan).toBe("RESPONS_TIDAK_SESUAI");
  });

  it("batas waktu terlampaui menjadi WAKTU_HABIS (fetch tiruan menolak saat sinyal dibatalkan)", async () => {
    const fetchTiruan = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, tolak) => {
          init!.signal!.addEventListener("abort", () => tolak(init!.signal!.reason));
        }),
    ) as unknown as typeof fetch;
    const galat = await galatDari(buat(fetchTiruan, 1).kirim(pesan));
    expect(galat.alasan).toBe("WAKTU_HABIS");
  });

  it("fetch yang melempar hal lain menjadi JARINGAN", async () => {
    const galat = await galatDari(buat(vi.fn().mockRejectedValue(new TypeError("fetch failed"))).kirim(pesan));
    expect(galat.alasan).toBe("JARINGAN");
  });
});

describe("buatPengirimMailtrap: tanpa kebocoran", () => {
  it("galat dan konsol tidak memuat token, penerima, subjek, teks, atau isi respons", async () => {
    const log = [
      vi.spyOn(console, "log").mockImplementation(() => {}),
      vi.spyOn(console, "error").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
    ];
    const rahasiaRespons = "isi-respons-rahasia";
    const kasus = [
      vi.fn().mockResolvedValue(json({ success: false, errors: [rahasiaRespons] }, 401)),
      vi.fn().mockResolvedValue(json({ success: false, errors: [rahasiaRespons] }, 500)),
      vi.fn().mockResolvedValue(json({ success: true, message_ids: [], x: rahasiaRespons })),
      vi.fn().mockRejectedValue(new TypeError(`gagal ${TOKEN} ${pesan.penerima}`)),
    ];
    for (const f of kasus) {
      const galat = await galatDari(buat(f).kirim(pesan));
      const semua = `${galat.message} ${galat.stack} ${JSON.stringify(galat)}`;
      for (const rahasia of [TOKEN, pesan.penerima, pesan.subjek, pesan.teks, rahasiaRespons]) {
        expect(semua).not.toContain(rahasia);
      }
    }
    for (const spy of log) {
      const keluaran = JSON.stringify(spy.mock.calls);
      expect(keluaran).not.toContain(TOKEN);
      expect(keluaran).not.toContain(pesan.penerima);
    }
  });
});
