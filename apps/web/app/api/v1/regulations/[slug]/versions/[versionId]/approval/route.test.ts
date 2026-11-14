import { revalidatePath } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jagaRoute } from "@/lib/akses/jaga-route";
import { buatMasalah } from "@/lib/api/masalah";
import { getAdminRegulationBySlug } from "@/lib/data/regulations";
import { findVersion, getPenandaVersi, sahkanVersiDenganAudit } from "@/lib/data/versions";
import {
  PESAN_TANGGAL_KEMBAR,
  PESAN_TANPA_BERKAS,
  VersionEffectiveDateTakenError,
  VersionNotEditableError,
  VersionWithoutFileError,
} from "@/lib/domain/versi-admin";
import { POST } from "./route";

// Lapisan data ditiru: modul asli (Prisma, next/server, server-only) tidak pernah dimuat.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/akses/jaga-route", () => ({ jagaRoute: vi.fn() }));
vi.mock("@/lib/data/regulations", () => ({ getAdminRegulationBySlug: vi.fn() }));
vi.mock("@/lib/data/versions", () => ({
  findVersion: vi.fn(),
  getPenandaVersi: vi.fn(),
  sahkanVersiDenganAudit: vi.fn(),
}));

const jagaMock = vi.mocked(jagaRoute);
const regulasiMock = vi.mocked(getAdminRegulationBySlug);
const penandaMock = vi.mocked(getPenandaVersi);
const versiMock = vi.mocked(findVersion);
const sahkanMock = vi.mocked(sahkanVersiDenganAudit);

const ORIGIN = "http://localhost:3000";
const VID = "0198a3a0-0000-7000-8000-000000000001";
const PENANDA = "2026-11-01T00:00:00.000Z";

const panggil = (o: { origin?: string | null; slug?: string; versionId?: string } = {}) => {
  const slug = o.slug ?? "aturan-contoh";
  const versionId = o.versionId ?? VID;
  const origin = o.origin === undefined ? ORIGIN : o.origin;
  return POST(
    new Request(`http://localhost:3000/api/v1/regulations/${slug}/versions/${versionId}/approval`, {
      method: "POST",
      headers: origin === null ? {} : { Origin: origin },
    }),
    { params: Promise.resolve({ slug, versionId }) },
  );
};

const status = async (r: Response) => ({ status: r.status, body: await r.json() });

beforeEach(() => {
  vi.clearAllMocks();
  // Nilai tiruan; env asli tidak dibaca.
  vi.stubEnv("BETTER_AUTH_SECRET", "x".repeat(32));
  vi.stubEnv("BETTER_AUTH_URL", ORIGIN);
  vi.spyOn(console, "error").mockImplementation(() => {});
  jagaMock.mockResolvedValue({ sesi: { userId: "u1", sesiId: "s1", email: "a@kampus.ac.id", role: "ADMIN" } });
  regulasiMock.mockResolvedValue({ id: "r1", name: "Aturan Contoh", slug: "aturan-contoh" } as never);
  penandaMock.mockResolvedValue(PENANDA);
  versiMock.mockResolvedValue({ id: VID, versionNumber: "2.0" } as never);
  sahkanMock.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST approval: Origin", () => {
  it.each([["https://evil.example"], [null], ["null"]])("Origin %s -> 403 dan tidak lanjut", async (origin) => {
    const r = await status(await panggil({ origin }));
    expect(r.status).toBe(403);
    expect(r.body.detail).toBe("Origin tidak diizinkan.");
    expect(jagaMock).not.toHaveBeenCalled();
    expect(sahkanMock).not.toHaveBeenCalled();
  });
});

describe("POST approval: akses", () => {
  it("anonim (Origin benar) -> 401", async () => {
    jagaMock.mockResolvedValue({ respons: buatMasalah("unauthenticated", new Request(ORIGIN), { detail: "Perlu masuk." }) });
    expect((await panggil()).status).toBe(401);
    expect(sahkanMock).not.toHaveBeenCalled();
  });

  it("Sivitas -> 403", async () => {
    jagaMock.mockResolvedValue({ respons: buatMasalah("forbidden", new Request(ORIGIN), { detail: "Tidak diizinkan." }) });
    expect((await panggil()).status).toBe(403);
    expect(sahkanMock).not.toHaveBeenCalled();
  });

  it("syarat yang diminta: admin", async () => {
    await panggil();
    expect(jagaMock.mock.calls[0][0]).toBe("admin");
    expect(jagaMock.mock.calls[0][2]).toBe("problem");
  });
});

describe("POST approval: 404", () => {
  it("slug tidak ada", async () => {
    regulasiMock.mockResolvedValue(undefined);
    expect((await panggil()).status).toBe(404);
    expect(sahkanMock).not.toHaveBeenCalled();
  });

  it("slug berformat salah: tanpa query", async () => {
    expect((await panggil({ slug: "Salah_Slug" })).status).toBe(404);
    expect(regulasiMock).not.toHaveBeenCalled();
  });

  it("versionId bukan UUID: tanpa query", async () => {
    expect((await panggil({ versionId: "bukan-uuid" })).status).toBe(404);
    expect(regulasiMock).not.toHaveBeenCalled();
    expect(penandaMock).not.toHaveBeenCalled();
  });

  it("versi bukan milik slug itu", async () => {
    penandaMock.mockResolvedValue(undefined);
    versiMock.mockResolvedValue(undefined);
    expect((await panggil()).status).toBe(404);
    expect(penandaMock).toHaveBeenCalledWith("r1", VID);
    expect(sahkanMock).not.toHaveBeenCalled();
  });

  it("penanda dibaca sebelum versi", async () => {
    await panggil();
    expect(penandaMock.mock.invocationCallOrder[0]).toBeLessThan(versiMock.mock.invocationCallOrder[0]);
  });
});

describe("POST approval: sukses", () => {
  it("200 { data: { id, status: SAH } }, actorId = userId, revalidatePath, no-store", async () => {
    const respons = await panggil();
    expect(respons.status).toBe(200);
    expect(respons.headers.get("Cache-Control")).toBe("no-store");
    expect(await respons.json()).toEqual({ data: { id: VID, status: "SAH" } });
    expect(sahkanMock).toHaveBeenCalledWith({
      regulasi: expect.objectContaining({ id: "r1", name: "Aturan Contoh" }),
      versi: expect.objectContaining({ id: VID, versionNumber: "2.0" }),
      penanda: new Date(PENANDA),
      admin: { id: "u1" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
});

describe("POST approval: galat domain dan lainnya", () => {
  it.each([
    ["VersionNotEditableError", new VersionNotEditableError("pesan asli rahasia-1"), "Versi bukan Draf atau sudah berubah."],
    ["VersionWithoutFileError", new VersionWithoutFileError("pesan asli rahasia-2"), PESAN_TANPA_BERKAS],
    ["VersionEffectiveDateTakenError", new VersionEffectiveDateTakenError("pesan asli rahasia-3"), PESAN_TANGGAL_KEMBAR],
  ])("%s -> 409 state-conflict, detail tetap", async (_nama, galat, detail) => {
    sahkanMock.mockRejectedValue(galat);
    const r = await status(await panggil());
    expect(r.status).toBe(409);
    expect(r.body.type).toBe("/problems/state-conflict");
    expect(r.body.detail).toBe(detail);
    expect(JSON.stringify(r.body)).not.toContain("rahasia");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("panggilan kedua (versi sudah tidak Draf) -> 409", async () => {
    sahkanMock.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new VersionNotEditableError("x"));
    expect((await panggil()).status).toBe(200);
    expect((await panggil()).status).toBe(409);
  });

  it("galat lain -> 500 internal-error, log hanya nama galat", async () => {
    sahkanMock.mockRejectedValue(new TypeError("jejak-rahasia"));
    const r = await status(await panggil());
    expect(r.status).toBe(500);
    expect(r.body.type).toBe("/problems/internal-error");
    expect(JSON.stringify(r.body)).not.toContain("jejak-rahasia");
    expect(console.error).toHaveBeenCalledWith("Galat pengesahan versi:", "TypeError");
  });
});
