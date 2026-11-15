import { beforeEach, describe, expect, it, vi } from "vitest";
import { findActiveUserById } from "@/lib/data/users";
import { getPrisma } from "@/lib/prisma";
import * as kategori from "./kategori/actions";
import * as perubahan from "./regulasi/[slug]/versi/[versionId]/perubahan/actions";
import * as versi from "./regulasi/[slug]/versi/actions";
import * as regulasi from "./regulasi/actions";
import * as verifikasi from "./verifikasi/actions";

// G2: semua modul Server Action admin. wajibAdmin dan bacaSesi ASLI; hanya sumber sesi
// (getAuth, findActiveUserById), next/*, dan seluruh lapisan data/penyimpanan yang ditiru. Setiap
// modul tiruan MELEMPAR bila tersentuh, sehingga aksi yang menyentuh data sebelum penjaga gagal terlihat.
// Modul domain, skema, lib/crypto/fingerprint, dan lib/domain/berkas-pdf tetap ASLI (murni, tanpa
// efek samping), kecuali yang membaca env atau disk.
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));
vi.mock("@/lib/auth", () => ({ getAuth: vi.fn() }));
vi.mock("@/lib/data/users", () => ({ findActiveUserById: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  getPrisma: vi.fn(() => {
    throw new Error("DATA_TERSENTUH:getPrisma");
  }),
}));

// Daftar fungsi per modul diturunkan dari impor aktual tiap berkas aksi.
const { data } = vi.hoisted(() => {
  const sentuh = (nama: string) =>
    vi.fn(() => {
      throw new Error(`DATA_TERSENTUH:${nama}`);
    });
  const modul = (...nama: string[]) => Object.fromEntries(nama.map((n) => [n, sentuh(n)]));
  return {
    data: {
      categories: modul("createCategory", "deleteEmptyCategory", "findCategoryById", "isCategorySlugTaken", "renameCategory"),
      regulations: modul("createRegulation", "deleteRegulation", "getAdminRegulationById", "isSlugTaken", "updateRegulation"),
      versions: modul("batalkanVersiDraf", "createVersion", "deleteDraftVersion", "sahkanVersiDenganAudit", "findVersion", "updateDraftVersion"),
      changes: modul("createChange", "deleteChange", "findChange", "updateChange"),
      verifikasiBerkas: modul("verifikasiBerkasDenganDb"),
      penyimpanan: modul("hapusBerkas", "simpanBerkas"),
    },
  };
});
vi.mock("@/lib/data/categories", () => data.categories);
vi.mock("@/lib/data/regulations", () => data.regulations);
vi.mock("@/lib/data/versions", () => data.versions);
vi.mock("@/lib/data/changes", () => data.changes);
vi.mock("@/lib/data/verifikasi-berkas", () => data.verifikasiBerkas);
vi.mock("@/lib/penyimpanan", () => data.penyimpanan);

const getSession = vi.fn();
const penggunaMock = vi.mocked(findActiveUserById);

const ID = "0198a3a0-0000-7000-8000-0000000000c1";
const ID_VERSI = "0198a3a0-0000-7000-8000-0000000000c2";
const ID_PERUBAHAN = "0198a3a0-0000-7000-8000-0000000000c3";
const SEBELUMNYA = {};
const form = (isi: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(isi)) f.set(k, v);
  return f;
};
const formNama = () => form({ name: "Kategori Uji" });
const formRegulasi = () => form({ name: "Regulasi Uji", categoryId: ID });
const formVersi = () =>
  form({ versionNumber: "1.0", effectiveDay: "1", effectiveMonth: "1", effectiveYear: "2026" });
const formPerubahan = () => form({ description: "Perubahan uji", source: "CHANGELOG" });
const formBerkas = () => {
  const f = new FormData();
  f.set("berkas", new File([new TextEncoder().encode("%PDF-1.4 isi")], "uji.pdf", { type: "application/pdf" }));
  return f;
};

// Argumen per aksi, dipilih agar aksi (bila lolos penjaga) sampai ke tiruan data. Penjaga ada di
// awal tiap aksi, jadi pada kasus penolakan isi argumen tidak berpengaruh.
const ARGUMEN: Record<string, (() => Promise<unknown>) | undefined> = {
  simpanKategori: () => kategori.simpanKategori(SEBELUMNYA, formNama()),
  gantiNamaKategori: () => kategori.gantiNamaKategori(ID, SEBELUMNYA, formNama()),
  hapusKategori: () => kategori.hapusKategori(ID),
  simpanRegulasi: () => regulasi.simpanRegulasi(SEBELUMNYA, formRegulasi()),
  ubahRegulasi: () => regulasi.ubahRegulasi(ID, SEBELUMNYA, formRegulasi()),
  hapusRegulasi: () => regulasi.hapusRegulasi(ID),
  simpanVersi: () => versi.simpanVersi(ID, SEBELUMNYA, formVersi()),
  ubahVersi: () => versi.ubahVersi(ID, ID_VERSI, SEBELUMNYA, formVersi()),
  hapusVersi: () => versi.hapusVersi(ID, ID_VERSI),
  sahkanVersi: () => versi.sahkanVersi(ID, ID_VERSI, "2026-01-01T00:00:00.000Z"),
  batalkanVersi: () => versi.batalkanVersi(ID, ID_VERSI),
  simpanPerubahan: () => perubahan.simpanPerubahan(ID, ID_VERSI, SEBELUMNYA, formPerubahan()),
  ubahPerubahan: () => perubahan.ubahPerubahan(ID, ID_VERSI, ID_PERUBAHAN, SEBELUMNYA, formPerubahan()),
  hapusPerubahan: () => perubahan.hapusPerubahan(ID, ID_VERSI, ID_PERUBAHAN),
  periksaBerkas: () => verifikasi.periksaBerkas({}, formBerkas()),
};

// periksaBerkas menangkap galat data di dalam try dan menjawab pesan umum, jadi pada kontrol
// positif galatnya tidak sampai ke pemanggil; yang dibuktikan: ia selesai dan data tersentuh.
const GALAT_DITELAN = new Set(["periksaBerkas"]);

// Nama aksi DIAMBIL dari ekspor tiap berkas aksi (bukan ditulis tangan).
const MODUL = { kategori, regulasi, versi, perubahan, verifikasi };
const AKSI: [string, string, (() => Promise<unknown>) | undefined, boolean][] = Object.entries(MODUL).flatMap(
  ([modul, ns]) => Object.keys(ns).map((nama): [string, string, (() => Promise<unknown>) | undefined, boolean] => [
    modul, nama, ARGUMEN[nama], GALAT_DITELAN.has(nama),
  ]),
);

const sesiAda = () =>
  getSession.mockResolvedValue({ session: { id: "s1" }, user: { id: "u1", role: "ADMIN" } });

// Keadaan penolak: nama, galat yang diharapkan dari penjaga asli, dan cara menyiapkannya.
const KEADAAN_DITOLAK: [string, string, () => void][] = [
  ["anonim", "REDIRECT:/masuk", () => getSession.mockResolvedValue(null)],
  [
    "SIVITAS",
    "NOT_FOUND",
    () => {
      sesiAda();
      penggunaMock.mockResolvedValue({
        id: "u1",
        email: "sivitas.uji.kyrion@student.universitaspertamina.ac.id",
        role: "SIVITAS",
      });
    },
  ],
  [
    "akun nonaktif",
    "REDIRECT:/masuk",
    () => {
      sesiAda();
      penggunaMock.mockResolvedValue(undefined);
    },
  ],
];

const semuaPemanggilanData = () => [
  ...Object.values(data).flatMap((grup) => Object.values(grup).flatMap((f) => f.mock.calls)),
  ...vi.mocked(getPrisma).mock.calls,
];

beforeEach(async () => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { getAuth } = await import("@/lib/auth");
  vi.mocked(getAuth).mockReturnValue({ api: { getSession } } as unknown as ReturnType<typeof getAuth>);
});

describe("daftar aksi yang diuji", () => {
  it("jumlah aksi per modul dan total (diturunkan dari ekspor berkas aksi)", () => {
    const hitung = Object.fromEntries(Object.entries(MODUL).map(([m, ns]) => [m, Object.keys(ns).length]));
    expect(hitung).toEqual({ kategori: 3, regulasi: 3, versi: 5, perubahan: 3, verifikasi: 1 });
    expect(AKSI).toHaveLength(15);
  });

  it.each(AKSI)("%s: %s punya argumen uji", (_modul, nama, panggil) => {
    expect(panggil, `argumen untuk aksi ${nama} belum didefinisikan di ARGUMEN`).toBeDefined();
  });
});

describe.each(AKSI)("%s: %s", (_modul, _aksi, panggil, galatDitelan) => {
  it.each(KEADAAN_DITOLAK)("%s -> melempar %s dan data tidak tersentuh", async (_keadaan, galat, siapkan) => {
    siapkan();
    await expect(panggil!()).rejects.toThrow(galat);
    expect(semuaPemanggilanData()).toEqual([]);
  });

  it("ADMIN aktif lolos penjaga: data tersentuh, galat berasal dari tiruan data bukan penjaga", async () => {
    sesiAda();
    penggunaMock.mockResolvedValue({
      id: "u1",
      email: "admin.uji.kyrion@universitaspertamina.ac.id",
      role: "ADMIN",
    });
    const hasil = await panggil!().then(
      () => "selesai",
      (e: unknown) => e,
    );
    if (galatDitelan) {
      expect(hasil).toBe("selesai");
    } else {
      expect(hasil).toBeInstanceOf(Error);
      expect((hasil as Error).message).toMatch(/^DATA_TERSENTUH:/);
    }
    expect(semuaPemanggilanData().length).toBeGreaterThan(0);
  });
});
