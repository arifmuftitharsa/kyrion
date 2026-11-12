import { describe, expect, it } from "vitest";
import { buatMasalah, DETAIL_INTERNAL, type JenisMasalah } from "./masalah";

const request = new Request("http://localhost/api/v1/regulations?x=1&y=2");
const errors = [{ field: "slug", message: "Wajib diisi" }];

function buat(jenis: JenisMasalah, req: Request = request): Response {
  switch (jenis) {
    case "validation-error":
      return buatMasalah(jenis, req, { detail: "d", errors });
    case "internal-error":
      return buatMasalah(jenis, req);
    default:
      return buatMasalah(jenis, req, { detail: "d" });
  }
}

const KASUS: [JenisMasalah, number, string][] = [
  ["validation-error", 400, "Masukan tidak valid"],
  ["unauthenticated", 401, "Belum masuk"],
  ["forbidden", 403, "Tidak berwenang"],
  ["not-found", 404, "Tidak ditemukan"],
  ["state-conflict", 409, "Keadaan tidak mengizinkan"],
  ["internal-error", 500, "Galat server"],
];

describe("buatMasalah", () => {
  it.each(KASUS)("%s: status, header, type, title", async (jenis, status, title) => {
    const res = buat(jenis);
    const body = await res.json();
    expect(res.status).toBe(status);
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(body.type).toBe(`/problems/${jenis}`);
    expect(body.title).toBe(title);
    expect(body.status).toBe(res.status);
  });

  it.each(KASUS)("%s: anggota body dan ekstensi errors", async (jenis) => {
    const body = await buat(jenis).json();
    const dasar = ["detail", "instance", "status", "title", "type"];
    const kunci = Object.keys(body).sort();
    if (jenis === "validation-error") {
      expect(kunci).toEqual([...dasar, "errors"].sort());
      expect(body.errors).toEqual(errors);
    } else {
      expect(kunci).toEqual(dasar);
    }
  });

  it("internal-error: detail persis kalimat tetap", async () => {
    const body = await buat("internal-error").json();
    expect(body.detail).toBe(DETAIL_INTERNAL);
  });

  it("tipe dan runtime: internal-error menolak detail, jenis lain menolak errors", async () => {
    // @ts-expect-error internal-error tidak menerima argumen ketiga
    const internal = await buatMasalah("internal-error", request, { detail: "x" }).json();
    expect(internal.detail).toBe(DETAIL_INTERNAL);
    // @ts-expect-error errors hanya untuk validation-error
    const lain = await buatMasalah("not-found", request, { detail: "x", errors }).json();
    expect("errors" in lain).toBe(false);
  });

  it.each([
    ["dengan query", "http://localhost/api/v1/regulations?x=1&y=2"],
    ["tanpa query", "http://localhost/api/v1/regulations"],
  ])("instance hanya pathname (%s)", async (_label, url) => {
    const body = await buat("not-found", new Request(url)).json();
    expect(body.instance).toBe("/api/v1/regulations");
  });
});