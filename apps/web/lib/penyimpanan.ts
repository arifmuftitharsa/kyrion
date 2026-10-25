import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// Penyimpanan berkas PDF versi (F-12) di disk, di luar folder publik. Nama berkas
// selalu dibuat server; nama kiriman pengguna tidak pernah dipakai sebagai path.

function tentukanRoot(): string {
  // turbopackIgnore: lokasi dibaca dari env saat runtime dan sengaja di luar bundel;
  // tanpa ini Turbopack menelusuri seluruh proyek untuk "path dinamis".
  const root = path.resolve(
    /* turbopackIgnore: true */ process.env.KYRION_STORAGE_DIR || path.join(process.cwd(), "storage"),
  );
  const publik = path.resolve(process.cwd(), "public");
  // Berkas di public/ bisa diunduh langsung tanpa pemeriksaan status maupun hash.
  if (root === publik || root.startsWith(publik + path.sep)) {
    throw new Error("KYRION_STORAGE_DIR tidak boleh berada di dalam folder public/");
  }
  return root;
}

const ROOT = tentukanRoot();

// Format kunci yang sah: UUID huruf kecil + ".pdf". Dicek juga untuk kunci dari DB.
const POLA_KUNCI = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;

/** Path absolut berkas; menolak kunci di luar format dan path yang keluar dari ROOT. */
function pathBerkas(key: string): string {
  if (!POLA_KUNCI.test(key)) throw new Error("Kunci berkas tidak valid");
  const lokasi = path.resolve(ROOT, key);
  if (!lokasi.startsWith(ROOT + path.sep)) throw new Error("Lokasi berkas di luar penyimpanan");
  return lokasi;
}

/** Menulis berkas baru dan mengembalikan kuncinya. Flag "wx" mencegah menimpa berkas. */
export async function simpanBerkas(bytes: Uint8Array): Promise<string> {
  await mkdir(ROOT, { recursive: true });
  const key = `${randomUUID()}.pdf`;
  await writeFile(pathBerkas(key), bytes, { flag: "wx" });
  return key;
}

export async function bacaBerkas(key: string): Promise<Buffer> {
  return readFile(/* turbopackIgnore: true */ pathBerkas(key));
}

/**
 * Menghapus berkas; tidak melempar. Dipanggil setelah DB berhasil atau sebagai
 * kompensasi, jadi kegagalan cukup dicatat (paling buruk menyisakan berkas yatim).
 */
export async function hapusBerkas(key: string): Promise<void> {
  try {
    await unlink(pathBerkas(key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    console.error("hapusBerkas gagal (berkas yatim):", key, error);
  }
}
