export type JenisMasalah =
  | "validation-error"
  | "unauthenticated"
  | "forbidden"
  | "not-found"
  | "state-conflict"
  | "internal-error";

export type GalatField = { field: string; message: string };

const MASALAH: Record<JenisMasalah, { status: number; title: string }> = {
  "validation-error": { status: 400, title: "Masukan tidak valid" },
  unauthenticated: { status: 401, title: "Belum masuk" },
  forbidden: { status: 403, title: "Tidak berwenang" },
  "not-found": { status: 404, title: "Tidak ditemukan" },
  "state-conflict": { status: 409, title: "Keadaan tidak mengizinkan" },
  "internal-error": { status: 500, title: "Galat server" },
};

/** Kalimat tetap; pesan galat asli tidak pernah masuk ke body. */
export const DETAIL_INTERNAL = "Terjadi kesalahan pada server.";

type JenisBiasa = Exclude<JenisMasalah, "validation-error" | "internal-error">;

/** Bangun respons galat RFC 9457 (application/problem+json). */
export function buatMasalah(
  jenis: "validation-error",
  request: Request,
  opsi: { detail: string; errors: GalatField[] },
): Response;
export function buatMasalah(jenis: "internal-error", request: Request): Response;
export function buatMasalah(jenis: JenisBiasa, request: Request, opsi: { detail: string }): Response;
export function buatMasalah(
  jenis: JenisMasalah,
  request: Request,
  opsi?: { detail: string; errors?: GalatField[] },
): Response {
  const { status, title } = MASALAH[jenis];
  const body = {
    type: `/problems/${jenis}`,
    title,
    status,
    detail: jenis === "internal-error" ? DETAIL_INTERNAL : opsi?.detail,
    instance: new URL(request.url).pathname,
    ...(jenis === "validation-error" && { errors: opsi?.errors }),
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/problem+json",
      "Cache-Control": "no-store",
    },
  });
}
