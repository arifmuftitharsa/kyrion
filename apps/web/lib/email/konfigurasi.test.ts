import { describe, expect, it, vi } from "vitest";
import { buatPengirim, GalatKonfigurasiEmail, NAMA_PENGIRIM, type EnvEmail } from "./konfigurasi";

const pesan = { penerima: "p@contoh.test", subjek: "S", teks: "T" };
const SEMUA = ["EMAIL_ADAPTER", "EMAIL_FROM", "MAILTRAP_API_TOKEN", "MAILTRAP_SANDBOX_ID", "NODE_ENV"];

const mailtrapLengkap: EnvEmail = {
  EMAIL_ADAPTER: "mailtrap",
  EMAIL_FROM: "kyrion@contoh.test",
  MAILTRAP_API_TOKEN: "token-sentinel-aa11",
  MAILTRAP_SANDBOX_ID: "9876",
  NODE_ENV: "production",
};

const deps = () => ({ fetch: vi.fn() as unknown as typeof fetch });

function galatDari(env: EnvEmail): GalatKonfigurasiEmail {
  try {
    buatPengirim(env, deps());
  } catch (e) {
    expect(e).toBeInstanceOf(GalatKonfigurasiEmail);
    return e as GalatKonfigurasiEmail;
  }
  throw new Error("seharusnya melempar");
}

describe("buatPengirim: EMAIL_ADAPTER", () => {
  it.each(["test", "development", "production"])("kosong dan tak dikenal ditolak saat NODE_ENV=%s", (NODE_ENV) => {
    for (const EMAIL_ADAPTER of [undefined, "", "smtp-rahasia"]) {
      const galat = galatDari({ ...mailtrapLengkap, EMAIL_ADAPTER, NODE_ENV });
      expect(galat.variabel).toEqual(["EMAIL_ADAPTER"]);
      expect(galat.message).not.toContain("smtp-rahasia");
    }
  });
});

describe("buatPengirim: memori dan konsol", () => {
  it.each(["memori", "konsol"])("%s ditolak bila NODE_ENV production, kosong, undefined, atau tak dikenal", (EMAIL_ADAPTER) => {
    for (const NODE_ENV of ["production", "", undefined, "staging"]) {
      const galat = galatDari({ EMAIL_ADAPTER, NODE_ENV });
      expect(galat.variabel).toEqual(["EMAIL_ADAPTER", "NODE_ENV"]);
      expect(galat.message).not.toContain("staging");
    }
  });

  it("memori lolos saat NODE_ENV test dan development", async () => {
    for (const NODE_ENV of ["test", "development"]) {
      const pengirim = buatPengirim({ EMAIL_ADAPTER: "memori", NODE_ENV }, deps());
      await expect(pengirim.kirim(pesan)).resolves.toBeUndefined();
    }
  });

  it("konsol lolos saat NODE_ENV development", () => {
    expect(() => buatPengirim({ EMAIL_ADAPTER: "konsol", NODE_ENV: "development" }, deps())).not.toThrow();
  });
});

describe("buatPengirim: mailtrap", () => {
  it.each([
    ["MAILTRAP_API_TOKEN", undefined],
    ["MAILTRAP_API_TOKEN", ""],
    ["MAILTRAP_SANDBOX_ID", undefined],
    ["MAILTRAP_SANDBOX_ID", "abc"],
    ["MAILTRAP_SANDBOX_ID", "0"],
    ["MAILTRAP_SANDBOX_ID", "-5"],
    ["MAILTRAP_SANDBOX_ID", "1.5"],
    ["EMAIL_FROM", undefined],
    ["EMAIL_FROM", "bukan-email-sentinel"],
  ])("%s bernilai %j ditolak; pesan menyebut nama, bukan nilai", (nama, nilai) => {
    const galat = galatDari({ ...mailtrapLengkap, [nama]: nilai });
    expect(galat.variabel).toEqual([nama]);
    expect(galat.message).toContain(nama);
    for (const [k, v] of Object.entries({ ...mailtrapLengkap, [nama]: nilai })) {
      if (v && !SEMUA.includes(v)) expect(galat.message, k).not.toContain(v);
    }
  });

  it("menyebut semua variabel bermasalah sekaligus tanpa nilainya", () => {
    const galat = galatDari({ EMAIL_ADAPTER: "mailtrap", MAILTRAP_SANDBOX_ID: "xyz-sentinel" });
    expect([...galat.variabel].sort()).toEqual(["EMAIL_FROM", "MAILTRAP_API_TOKEN", "MAILTRAP_SANDBOX_ID"]);
    expect(galat.message).not.toContain("xyz-sentinel");
  });

  it("konfigurasi lengkap lolos di production dan memanggil fetch dengan from dari konfigurasi", async () => {
    const fetchTiruan = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, message_ids: ["m"] }), { status: 200 }),
    );
    const pengirim = buatPengirim(mailtrapLengkap, { fetch: fetchTiruan });
    await pengirim.kirim(pesan);
    const [url, init] = fetchTiruan.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://sandbox.api.mailtrap.io/api/send/9876");
    expect((init.headers as Record<string, string>)["Api-Token"]).toBe("token-sentinel-aa11");
    expect(JSON.parse(init.body as string).from).toEqual({ email: "kyrion@contoh.test", name: NAMA_PENGIRIM });
  });
});
