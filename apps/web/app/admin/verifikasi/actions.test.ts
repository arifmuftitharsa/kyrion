import { beforeEach, describe, expect, it, vi } from "vitest";
import { verifikasiBerkasDenganDb } from "@/lib/data/verifikasi-berkas";
import { simpanBerkas } from "@/lib/penyimpanan";
import { wajibAdmin } from "@/lib/sesi";
import { periksaBerkas } from "./actions";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/sesi", () => ({ wajibAdmin: vi.fn() }));
vi.mock("@/lib/data/verifikasi-berkas", () => ({ verifikasiBerkasDenganDb: vi.fn() }));
vi.mock("@/lib/penyimpanan", () => ({ simpanBerkas: vi.fn(), hapusBerkas: vi.fn() }));

const layanan = vi.mocked(verifikasiBerkasDenganDb);
const admin = vi.mocked(wajibAdmin);

function form(isi?: BlobPart[], nama = "a.pdf"): FormData {
  const f = new FormData();
  if (isi) f.set("berkas", new File(isi, nama, { type: "application/pdf" }));
  return f;
}
const pdf = () => form([new TextEncoder().encode("%PDF-1.4 isi")]);

beforeEach(() => {
  vi.clearAllMocks();
  admin.mockResolvedValue({ id: "u1", email: "a@x.id" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("periksaBerkas", () => {
  it("B-09 Sivitas: wajibAdmin melempar notFound, layanan tidak dipanggil", async () => {
    admin.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(periksaBerkas({}, pdf())).rejects.toThrow("NOT_FOUND");
    expect(layanan).not.toHaveBeenCalled();
  });

  it("B-08 bukan PDF ditolak", async () => {
    const hasil = await periksaBerkas({}, form(["bukan pdf sama sekali"], "a.pdf"));
    expect(hasil).toEqual({ galatBerkas: "Berkas bukan PDF yang valid." });
    expect(layanan).not.toHaveBeenCalled();
  });

  it("B-08 di atas 10 MB ditolak", async () => {
    const besar = new Uint8Array(10 * 1024 * 1024 + 1);
    besar.set(new TextEncoder().encode("%PDF-"));
    const hasil = await periksaBerkas({}, form([besar]));
    expect(hasil.galatBerkas).toBe("Ukuran berkas maksimal 10 MB.");
    expect(layanan).not.toHaveBeenCalled();
  });

  it("tanpa berkas dan berkas kosong ditolak", async () => {
    expect((await periksaBerkas({}, form())).galatBerkas).toBeDefined();
    expect((await periksaBerkas({}, form([], "kosong.pdf"))).galatBerkas).toBe("Berkas PDF kosong.");
    expect(layanan).not.toHaveBeenCalled();
  });

  it("PDF valid: hasil dari layanan; berkas tidak ditulis ke penyimpanan", async () => {
    layanan.mockResolvedValue([{ hasil: "tidak-cocok", alasan: "berkas-tidak-dikenal" }]);
    const hasil = await periksaBerkas({}, pdf());
    expect(hasil).toEqual({ hasil: [{ hasil: "tidak-cocok", alasan: "berkas-tidak-dikenal" }] });
    expect(layanan).toHaveBeenCalledTimes(1);
    expect(layanan.mock.calls[0][1]).toMatch(/^[0-9a-f]{64}$/);
    expect(simpanBerkas).not.toHaveBeenCalled();
  });

  it("galat operasional (keyring, kunci induk, DB): galat umum, bukan hasil verifikasi, tanpa detail", async () => {
    layanan.mockRejectedValue(new Error("rahasia: /jalur/keyring.json"));
    const hasil = await periksaBerkas({}, pdf());
    expect(hasil.hasil).toBeUndefined();
    expect(hasil.pesan).toBe(
      "Pemeriksaan tidak dapat dilakukan saat ini. Coba lagi, atau hubungi pengelola sistem.",
    );
    expect(JSON.stringify(hasil)).not.toContain("rahasia");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("rahasia");
  });
});
