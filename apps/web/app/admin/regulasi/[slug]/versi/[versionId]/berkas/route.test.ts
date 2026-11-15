import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminRegulationBySlug } from "@/lib/data/regulations";
import { findVersionFile } from "@/lib/data/versions";
import { periksaBerkasVersi } from "@/lib/integritas-versi";
import { bacaBerkas } from "@/lib/penyimpanan";
import { bacaSesi } from "@/lib/sesi";
import type { BerkasTersimpan } from "@/lib/types";
import { GET } from "./route";

// jagaRoute dan unduhan-pdf ASLI; hanya sesi, data, penyimpanan, dan pemeriksa integritas ditiru.
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("@/lib/sesi", () => ({ bacaSesi: vi.fn() }));
vi.mock("@/lib/data/regulations", () => ({ getAdminRegulationBySlug: vi.fn() }));
vi.mock("@/lib/data/versions", () => ({ findVersionFile: vi.fn() }));
vi.mock("@/lib/penyimpanan", () => ({ bacaBerkas: vi.fn() }));
vi.mock("@/lib/integritas-versi", () => ({ periksaBerkasVersi: vi.fn() }));

const sesiMock = vi.mocked(bacaSesi);
const regulasiMock = vi.mocked(getAdminRegulationBySlug);
const berkasMock = vi.mocked(findVersionFile);
const bacaMock = vi.mocked(bacaBerkas);
const periksaMock = vi.mocked(periksaBerkasVersi);

const SLUG = "pedoman-akademik";
const REGULASI_ID = "0198a3a0-0000-7000-8000-0000000000a1";
const VERSI_ID = "0198a3a0-0000-7000-8000-0000000000b1";
const ID_SESI = { userId: "u1", sesiId: "s1", email: "a@kampus.ac.id" };
const sesiPeran = (role: string) => ({ ...ID_SESI, role }) as never;

const berkas: BerkasTersimpan = {
  id: VERSI_ID,
  regulationId: REGULASI_ID,
  versionNumber: "1.0",
  effectiveDate: "2026-01-01",
  key: "kunci-di-disk",
  name: "pedoman.pdf",
  size: 8,
  sha256: "a".repeat(64),
  tag: "v1$" + "b".repeat(64),
};
const ISI_PDF = Buffer.from("%PDF-1.4");

const panggil = (slug = SLUG, versionId = VERSI_ID) =>
  GET(new Request(`http://localhost/admin/regulasi/${slug}/versi/${versionId}/berkas`), {
    params: Promise.resolve({ slug, versionId }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  sesiMock.mockResolvedValue(sesiPeran("ADMIN"));
  regulasiMock.mockResolvedValue({ id: REGULASI_ID } as never);
  berkasMock.mockResolvedValue(berkas);
  bacaMock.mockResolvedValue(ISI_PDF);
  periksaMock.mockResolvedValue(undefined as never);
});

describe("GET unduh berkas admin: penolakan menurut peran", () => {
  // Urutan kolom (nama, status, peran) agar %s dan %i pada judul mengambil nama dan status.
  it.each<[string, number, string | null, string]>([
    ["anonim", 401, null, "Perlu masuk."],
    ["SIVITAS", 403, "SIVITAS", "Tidak diizinkan."],
    ["peran tak dikenal", 403, "TAMU", "Tidak diizinkan."],
  ])("%s -> %i teks, data dan berkas tidak disentuh", async (_nama, status, peran, pesan) => {
    sesiMock.mockResolvedValue(peran === null ? null : sesiPeran(peran));
    const respons = await panggil();
    expect(respons.status).toBe(status);
    expect(respons.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(await respons.text()).toBe(pesan);
    expect(regulasiMock).not.toHaveBeenCalled();
    expect(berkasMock).not.toHaveBeenCalled();
    expect(bacaMock).not.toHaveBeenCalled();
  });
});

describe("GET unduh berkas admin: ADMIN", () => {
  it("parameter jelek (slug dan versionId) -> 404, data tidak dipanggil", async () => {
    expect((await panggil("SALAH!")).status).toBe(404);
    expect((await panggil(SLUG, "bukan-uuid")).status).toBe(404);
    expect(regulasiMock).not.toHaveBeenCalled();
    expect(berkasMock).not.toHaveBeenCalled();
  });

  it("regulasi tidak ada -> 404, berkas tidak dicari", async () => {
    regulasiMock.mockResolvedValue(undefined);
    const respons = await panggil();
    expect(respons.status).toBe(404);
    expect(berkasMock).not.toHaveBeenCalled();
    expect(bacaMock).not.toHaveBeenCalled();
  });

  it("versi milik regulasi lain: findVersionFile(regulasi.id, versionId) kosong -> 404", async () => {
    berkasMock.mockResolvedValue(undefined);
    const respons = await panggil();
    expect(berkasMock).toHaveBeenCalledWith(REGULASI_ID, VERSI_ID);
    expect(respons.status).toBe(404);
    expect(bacaMock).not.toHaveBeenCalled();
  });

  // Penangan tidak melihat status: findVersionFile tidak menyaringnya dan data tiruan tidak
  // membawa status. Uji ini hanya menunjukkan unduhan tidak bergantung pada status versi
  // (DRAF, SAH, DIGANTIKAN, DIBATALKAN sama saja); ia TIDAK membuktikan penyaringan status.
  it("unduhan tidak bergantung pada status versi: 200 dengan header unduhan", async () => {
    const respons = await panggil();
    expect(respons.status).toBe(200);
    expect(berkasMock).toHaveBeenCalledWith(REGULASI_ID, VERSI_ID);
    expect(respons.headers.get("Content-Type")).toBe("application/pdf");
    expect(respons.headers.get("Content-Length")).toBe(String(ISI_PDF.length));
    expect(respons.headers.get("Content-Disposition")).toBe(
      `attachment; filename="pedoman.pdf"; filename*=UTF-8''pedoman.pdf`,
    );
    expect(respons.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(respons.headers.get("Cache-Control")).toBe("no-store");
    expect(Buffer.from(await respons.arrayBuffer()).equals(ISI_PDF)).toBe(true);
  });
});
