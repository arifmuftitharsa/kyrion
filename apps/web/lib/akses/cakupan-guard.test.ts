import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// UJI STATIS. Hanya membuktikan bahwa teks pemanggilan penjaga ADA (dan, untuk Server Action,
// muncul sebagai `await` pertama menurut pola teks). Perilaku penjaga (anonim, peran salah,
// akun nonaktif) dibuktikan uji lain: lib/sesi.test.ts, lib/akses/jaga-route.test.ts, uji rute
// dan uji aksi. Uji ini mencegah halaman, aksi, atau rute BARU lupa memasang penjaga.
//
// Batas pola teks (bisa membuat hasil salah):
// - Fungsi aksi hanya dikenali bentuk `export async function nama`. Bentuk lain (`export const x =`,
//   `export function`, `export { x }`) dilaporkan sebagai pelanggaran tersendiri, bukan diabaikan.
// - "await pertama" dicari setelah nama fungsi sampai deklarasi ekspor berikutnya; await di dalam
//   nilai bawaan parameter akan terhitung. Komentar `//` dan `/* */` dibuang sebelum dicari;
//   tanda `//` di dalam string (mis. URL) ikut memotong sisa barisnya.
// - Pemanggilan lewat alias atau pembungkus (bukan nama wajibAdmin/wajibMasuk/jagaRoute) tidak dikenali.
// - Memanggil penjaga tidak berarti hasilnya dipakai; itu urusan uji perilaku.

const AKAR_APP = fileURLToPath(new URL("../../app", import.meta.url));

function telusuri(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name === "node_modules" || e.name === ".next") return [];
    const penuh = join(dir, e.name);
    return e.isDirectory() ? telusuri(penuh) : [penuh];
  });
}

// Jalur relatif terhadap apps/web/app, pemisah selalu "/".
const semuaBerkas = telusuri(AKAR_APP)
  .map((p) => relative(AKAR_APP, p).replaceAll("\\", "/"))
  .sort();

const baca = (rel: string) => readFileSync(join(AKAR_APP, rel), "utf8");
const hapusKomentar = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const tanpaSpasi = (s: string) => s.replace(/\s+/g, "");

// Pengecualian eksplisit. Menambah isinya adalah keputusan keamanan: tulis alasannya.

/** /masuk harus terbuka untuk anonim (halaman login); page.tsx-nya mengalihkan yang sudah masuk. */
const HALAMAN_TERBUKA = ["masuk/page.tsx"];

/**
 * Himpunan fungsi di app/masuk/actions.ts yang sengaja tanpa penjaga. Hanya `keluar`:
 * ia memanggil signOut tanpa sesi sama dengan tanpa efek. Permintaan dan verifikasi OTP
 * TIDAK ada di sini; keduanya lewat /api/auth dan dijaga allowlist di lib/auth/izin.ts.
 */
const AKSI_TERBUKA = { berkas: "masuk/actions.ts", fungsi: ["keluar"] };

/** Rute yang tidak memakai jagaRoute, dengan alasan. */
const RUTE_TANPA_JAGA_ROUTE: Record<string, string> = {
  "api/auth/[...all]": "pintu Better Auth; dijaga allowlist lib/auth/izin.ts di hooks.before",
  "api/[[...jalur]]": "penangkap jalur /api tak dikenal; selalu 404 tanpa data",
};

/** Inventaris tertulis semua route.ts. Rute baru wajib ditambahkan di sini secara sadar. */
const INVENTARIS_RUTE = [
  "admin/regulasi/[slug]/versi/[versionId]/berkas/route.ts",
  "api/[[...jalur]]/route.ts",
  "api/auth/[...all]/route.ts",
  "api/v1/regulations/[slug]/current-version/route.ts",
  "api/v1/regulations/[slug]/route.ts",
  "api/v1/regulations/[slug]/versions/[versionId]/approval/route.ts",
  "api/v1/regulations/route.ts",
  "api/v1/sessions/[id]/route.ts",
  "api/v1/sessions/route.ts",
];

const berkasNama = (nama: string) => semuaBerkas.filter((p) => p === nama || p.endsWith(`/${nama}`));
const halamanAdmin = berkasNama("page.tsx").filter((p) => p.startsWith("admin/"));
const halamanLain = berkasNama("page.tsx").filter((p) => !p.startsWith("admin/") && !HALAMAN_TERBUKA.includes(p));
const aksiAdmin = berkasNama("actions.ts").filter((p) => p.startsWith("admin/"));
const aksiAkun = berkasNama("actions.ts").filter((p) => p.startsWith("akun/"));
const rute = berkasNama("route.ts");

type Fungsi = { nama: string; awaitPertama: string | undefined };

/** Semua `export async function` dan `await` pertama di tiap badannya (null = bentuk ekspor lain ada). */
function bacaAksi(rel: string): { fungsi: Fungsi[]; bentukLain: string[] } {
  const bersih = hapusKomentar(baca(rel));
  const cocok = [...bersih.matchAll(/export\s+async\s+function\s+(\w+)/g)];
  const fungsi = cocok.map((m, i) => {
    const mulai = m.index + m[0].length;
    const akhir = cocok[i + 1]?.index ?? bersih.length;
    const await1 = bersih.slice(mulai, akhir).match(/\bawait\s+([A-Za-z_$][\w$]*\s*\()/);
    return { nama: m[1], awaitPertama: await1 ? tanpaSpasi(await1[1]) : undefined };
  });
  // Ekspor selain async function (type dan interface dihapus saat kompilasi, jadi diizinkan).
  const bentukLain = [...bersih.matchAll(/^export\s+(?!async\s+function\b|type\b|interface\b)[^\n]*/gm)].map((m) => m[0].trim());
  return { fungsi, bentukLain };
}

describe("cakupan terdeteksi (pengaman agar penelusuran tidak kosong)", () => {
  it("setiap kategori punya berkas", () => {
    expect(halamanAdmin.length).toBeGreaterThan(0);
    expect(halamanLain.length).toBeGreaterThan(0);
    expect(aksiAdmin.length).toBeGreaterThan(0);
    expect(aksiAkun).toEqual(["akun/sesi/actions.ts"]);
    expect(rute.length).toBeGreaterThan(0);
  });
});

describe("(a) halaman admin memanggil wajibAdmin(", () => {
  it.each(halamanAdmin)("%s", (rel) => {
    expect(hapusKomentar(baca(rel)).includes("wajibAdmin("), `${rel} tidak memanggil wajibAdmin(`).toBe(true);
  });
});

describe("(b) halaman lain (kecuali HALAMAN_TERBUKA) memanggil wajibMasuk( atau wajibAdmin(", () => {
  it.each(halamanLain)("%s", (rel) => {
    const isi = hapusKomentar(baca(rel));
    expect(isi.includes("wajibMasuk(") || isi.includes("wajibAdmin("), `${rel} tanpa wajibMasuk( atau wajibAdmin(`).toBe(true);
  });
});

describe("(c) Server Action: await pertama tiap fungsi ekspor adalah penjaga", () => {
  it.each([
    ...aksiAdmin.map((rel): [string, string] => [rel, "wajibAdmin("]),
    ...aksiAkun.map((rel): [string, string] => [rel, "wajibMasuk("]),
  ])("%s -> await pertama %s", (rel, penjaga) => {
    const { fungsi, bentukLain } = bacaAksi(rel);
    expect(bentukLain, `${rel} punya ekspor selain async function`).toEqual([]);
    expect(fungsi.length, `${rel} tidak punya fungsi ekspor terdeteksi`).toBeGreaterThan(0);
    const melanggar = fungsi.filter((f) => f.awaitPertama !== penjaga).map((f) => f.nama);
    expect(melanggar, `${rel}: await pertama bukan ${penjaga} pada fungsi`).toEqual([]);
  });

  it(`${AKSI_TERBUKA.berkas}: himpunan fungsi sama dengan yang dinyatakan terbuka`, () => {
    const { fungsi, bentukLain } = bacaAksi(AKSI_TERBUKA.berkas);
    expect(bentukLain, `${AKSI_TERBUKA.berkas} punya ekspor selain async function`).toEqual([]);
    expect(fungsi.map((f) => f.nama).sort()).toEqual([...AKSI_TERBUKA.fungsi].sort());
  });
});

describe("(d) route.ts", () => {
  it("himpunan route.ts sama persis dengan inventaris tertulis", () => {
    expect(rute).toEqual([...INVENTARIS_RUTE].sort());
  });

  it.each(rute.filter((p) => !(p.replace(/\/route\.ts$/, "") in RUTE_TANPA_JAGA_ROUTE)))("%s memanggil jagaRoute(", (rel) => {
    expect(hapusKomentar(baca(rel)).includes("jagaRoute("), `${rel} tidak memanggil jagaRoute(`).toBe(true);
  });

  it.each(Object.keys(RUTE_TANPA_JAGA_ROUTE))("pengecualian %s memang ada di inventaris", (dir) => {
    expect(INVENTARIS_RUTE).toContain(`${dir}/route.ts`);
  });
});
