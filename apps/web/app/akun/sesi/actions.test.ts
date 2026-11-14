import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cabutSesi } from "@/lib/data/sesi";
import { wajibMasuk } from "@/lib/sesi";
import { cabutSesiSaya } from "./actions";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("@/lib/sesi", () => ({ wajibMasuk: vi.fn() }));
vi.mock("@/lib/data/sesi", () => ({ cabutSesi: vi.fn() }));

const SAYA = "0198a3a0-0000-7000-8000-000000000001";
const LAIN = "0198a3a0-0000-7000-8000-000000000002";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(wajibMasuk).mockResolvedValue({
    userId: "u1",
    sesiId: SAYA,
    email: "a@kampus.ac.id",
    role: "SIVITAS",
  });
});

describe("cabutSesiSaya", () => {
  it("sesi lain berhasil dicabut: tanpa redirect, pemilik = userId sesi", async () => {
    vi.mocked(cabutSesi).mockResolvedValue(true);
    expect(await cabutSesiSaya(LAIN)).toEqual({});
    expect(cabutSesi).toHaveBeenCalledWith(LAIN, "u1");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("sesi sendiri dicabut -> redirect /masuk", async () => {
    vi.mocked(cabutSesi).mockResolvedValue(true);
    await expect(cabutSesiSaya(SAYA)).rejects.toThrow("REDIRECT:/masuk");
  });

  it("cabutSesi false -> pesan umum, tanpa redirect", async () => {
    vi.mocked(cabutSesi).mockResolvedValue(false);
    const hasil = await cabutSesiSaya(LAIN);
    expect(hasil.pesan).toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("id bukan UUID -> pesan umum, data tidak dipanggil", async () => {
    const hasil = await cabutSesiSaya("bukan-uuid");
    expect(hasil.pesan).toBeTruthy();
    expect(cabutSesi).not.toHaveBeenCalled();
  });
});
