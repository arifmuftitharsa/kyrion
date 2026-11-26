import { generateKeyPairSync, randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { dataTerlindungDariBaris } from "@/lib/crypto/data-terlindung";
import { fingerprint } from "@/lib/crypto/fingerprint";
import { buatTagVersi } from "@/lib/crypto/mac";
import { idKunci } from "@/lib/crypto/tanda-tangan";
import { tandatanganiPengesahan } from "@/lib/crypto/tanda-tangan-pengesahan";
import { bacaKeyringDariEnv } from "@/lib/data/verifikasi-env";
import { muatKunciInduk } from "@/lib/integritas-versi";
import { getPrisma } from "@/lib/prisma";
import { verifikasiBerkasDenganDb } from "./verifikasi-berkas";

// Hanya batas I/O yang ditiru (DB, keyring, kunci induk). Sidik, HMAC, dan Ed25519 nyata.
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("@/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/lib/integritas-versi", () => ({ muatKunciInduk: vi.fn() }));
vi.mock("@/lib/data/verifikasi-env", () => ({ bacaKeyringDariEnv: vi.fn() }));

/** Satu versi SAH yang sungguh bertag dan bertanda tangan atas `bytes`. */
function siapkanVersiSah(bytes: Uint8Array): void {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const der = publicKey.export({ type: "spki", format: "der" });
  const id = idKunci(der);
  const dibuat = new Date("2026-01-01T00:00:00.000Z");
  const approvedAt = new Date("2026-03-03T00:00:00.000Z");
  const approvedById = "0198a3a0-0000-7000-8000-000000000003";
  const kolom = {
    id: "0198a3a0-0000-7000-8000-000000000001",
    regulationId: "0198a3a0-0000-7000-8000-000000000002",
    versionNumber: "2026/1",
    effectiveDate: dibuat,
    fileSha256: fingerprint(bytes),
    fileName: "uji.pdf",
    fileSize: bytes.length,
  };
  const data = dataTerlindungDariBaris(kolom)!;
  const kunciInduk = randomBytes(32);
  const versi = {
    ...kolom,
    status: "SAH",
    regulation: { name: "Peraturan Uji" },
    integrityTag: buatTagVersi(kunciInduk, data),
    signature: new Uint8Array(
      tandatanganiPengesahan({
        penandatangan: { kunciPrivat: privateKey, idKunci: id },
        versi: data,
        approvedById,
        approvedAt,
      }),
    ),
    signingKeyId: id,
    approvedById,
    approvedAt,
  };

  vi.mocked(muatKunciInduk).mockResolvedValue(kunciInduk);
  vi.mocked(bacaKeyringDariEnv).mockResolvedValue({
    versi: 1,
    kunci: [
      {
        id,
        kunciPublik: der.toString("base64"),
        status: "aktif",
        dibuatPada: dibuat.toISOString(),
        dirotasiPada: null,
        dicabutPada: null,
      },
    ],
  });
  vi.mocked(getPrisma).mockReturnValue({
    version: {
      // Menyaring menurut `where` dari kode produksi: bila saringan sidik hilang, semua baris kembali.
      findMany: async ({ where }: { where: { fileSha256?: string } }) =>
        [versi].filter((v) => where.fileSha256 === undefined || v.fileSha256 === where.fileSha256),
    },
    signingKey: {
      findMany: async () => [
        { id, publicKey: new Uint8Array(der), status: "AKTIF", createdAt: dibuat, rotatedAt: null, revokedAt: null },
      ],
    },
  } as unknown as ReturnType<typeof getPrisma>);
}

describe("verifikasiBerkasDenganDb", () => {
  it("B-03 PDF diubah satu byte: asli lolos, salinan menjadi tidak cocok (berkas tidak dikenal)", async () => {
    const asli = new TextEncoder().encode("%PDF-1.4 DATA SINTETIS B-03");
    siapkanVersiSah(asli);
    const ubahan = Uint8Array.from(asli);
    ubahan[ubahan.length - 1] ^= 1;
    expect(ubahan).toHaveLength(asli.length);
    expect(ubahan.filter((byte, i) => byte !== asli[i])).toHaveLength(1);

    // Sidik dihitung dari bytes yang diperiksa, seperti di periksaBerkas.
    const periksa = (bytes: Uint8Array) => verifikasiBerkasDenganDb(bytes, fingerprint(bytes));

    await expect(periksa(asli)).resolves.toMatchObject([{ hasil: "asli-sah", alasan: "berlaku" }]);
    await expect(periksa(ubahan)).resolves.toEqual([{ hasil: "tidak-cocok", alasan: "berkas-tidak-dikenal" }]);
  });
});
