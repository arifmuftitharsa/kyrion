import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KeyringTidakValid } from "@/lib/crypto/keyring";
import { PenandatanganTidakValid, siapkanPenandatangan } from "@/lib/crypto/penandatangan";
import { PESAN_KUNCI_BELUM_SIAP, PenandatanganBelumSiapError } from "@/lib/domain/versi-admin";
import { siapkanPenandatanganDariEnv } from "./penandatangan-env";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/crypto/penandatangan", async (asli) => ({
  ...(await asli<typeof import("@/lib/crypto/penandatangan")>()),
  siapkanPenandatangan: vi.fn(),
}));

const siap = vi.mocked(siapkanPenandatangan);

beforeEach(() => {
  vi.stubEnv("KYRION_SIGNING_KEY_FILE", "/nilai/tiruan/kunci.pem");
  vi.stubEnv("KYRION_KEYRING_FILE", "/nilai/tiruan/keyring.json");
});
afterEach(() => vi.unstubAllEnvs());

describe("siapkanPenandatanganDariEnv", () => {
  it("meneruskan lokasi dari env dan mengembalikan penandatangan", async () => {
    const hasil = { kunciPrivat: {}, idKunci: "a".repeat(32) };
    siap.mockResolvedValue(hasil as never);
    await expect(siapkanPenandatanganDariEnv()).resolves.toBe(hasil);
    expect(siap).toHaveBeenCalledWith({
      berkasKunciPrivat: "/nilai/tiruan/kunci.pem",
      berkasKeyring: "/nilai/tiruan/keyring.json",
    });
  });

  it.each([
    ["PenandatanganTidakValid", new PenandatanganTidakValid("x")],
    ["KeyringTidakValid", new KeyringTidakValid("x")],
  ])("%s dibungkus PenandatanganBelumSiapError dengan pesan tetap tanpa jalur berkas", async (_n, galat) => {
    siap.mockRejectedValue(galat);
    const diterima = await siapkanPenandatanganDariEnv().catch((e: unknown) => e);
    expect(diterima).toBeInstanceOf(PenandatanganBelumSiapError);
    expect((diterima as Error).message).toBe(PESAN_KUNCI_BELUM_SIAP);
    expect((diterima as Error).message).not.toContain("/nilai");
  });

  it("galat lain tidak dibungkus", async () => {
    const galat = new Error("lain");
    siap.mockRejectedValue(galat);
    await expect(siapkanPenandatanganDariEnv()).rejects.toBe(galat);
  });
});
