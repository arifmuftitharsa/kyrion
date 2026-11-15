import { generateKeyPairSync, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fingerprint } from "./fingerprint";
import { dataTerlindungDariBaris } from "./data-terlindung";
import { idKunci } from "./tanda-tangan";
import { tandatanganiPengesahan } from "./tanda-tangan-pengesahan";
import { buatTagVersi } from "./mac";
import type { EntriKunci } from "./keyring";
import type { HasilVerifikasi } from "./hasil-verifikasi";
import {
  verifikasiBerkas,
  type BarisKunciDb,
  type KandidatVersi,
  type MasukanVerifikasi,
} from "./verifikasi-pengesahan";

// Kripto NYATA: kunci Ed25519 sungguhan, tanda tangan dari tandatanganiPengesahan (kode K5),
// tag dari buatTagVersi. Tidak ada mock verifikasi.

const RID = "0198a3a0-0000-7000-8000-000000000002";
const VID = "0198a3a0-0000-7000-8000-000000000001";
const VID2 = "0198a3a0-0000-7000-8000-000000000004";
const UID = "0198a3a0-0000-7000-8000-000000000003";
const UID2 = "0198a3a0-0000-7000-8000-000000000005";
const BYTES = new TextEncoder().encode("%PDF-1.4 berkas uji");
const SHA = fingerprint(BYTES);
const KUNCI_INDUK = randomBytes(32);
const DIBUAT = "2026-01-01T00:00:00.000Z";
const DISAHKAN = new Date("2026-03-03T00:00:00.000Z");

function buatKunci() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const der = publicKey.export({ type: "spki", format: "der" });
  const id = idKunci(der);
  const entri: EntriKunci = {
    id,
    kunciPublik: der.toString("base64"),
    status: "aktif",
    dibuatPada: DIBUAT,
    dirotasiPada: null,
    dicabutPada: null,
  };
  const db: BarisKunciDb = {
    id,
    publicKey: new Uint8Array(der),
    status: "AKTIF",
    createdAt: new Date(DIBUAT),
    rotatedAt: null,
    revokedAt: null,
  };
  return { entri, db, penandatangan: { kunciPrivat: privateKey, idKunci: id } };
}
const K1 = buatKunci();
const K2 = buatKunci();

const dasar: KandidatVersi = {
  id: VID,
  regulationId: RID,
  namaRegulasi: "Peraturan Uji",
  versionNumber: "2026/1",
  effectiveDate: new Date("2026-01-01T00:00:00.000Z"),
  status: "SAH",
  fileSha256: SHA,
  fileName: "uji.pdf",
  fileSize: BYTES.length,
  integrityTag: null,
  signature: null,
  signingKeyId: null,
  approvedById: null,
  approvedAt: null,
};

/** Versi SAH yang ditandatangani dan bertag dengan benar; `ubah` mengganti kolom SESUDAH ditandatangani. */
function versiBertanda(
  k = K1,
  awal: Partial<KandidatVersi> = {},
  ubah: Partial<KandidatVersi> = {},
  hitungUlangTag = false,
): KandidatVersi {
  const bahan = { ...dasar, ...awal };
  const data = dataTerlindungDariBaris(bahan)!;
  const utuh: KandidatVersi = {
    ...bahan,
    integrityTag: buatTagVersi(KUNCI_INDUK, data),
    signature: new Uint8Array(
      tandatanganiPengesahan({ penandatangan: k.penandatangan, versi: data, approvedById: UID, approvedAt: DISAHKAN }),
    ),
    signingKeyId: k.entri.id,
    approvedById: UID,
    approvedAt: DISAHKAN,
  };
  const hasil = { ...utuh, ...ubah };
  if (hitungUlangTag) hasil.integrityTag = buatTagVersi(KUNCI_INDUK, dataTerlindungDariBaris(hasil)!);
  return hasil;
}

function masukan(o: Partial<MasukanVerifikasi> = {}): MasukanVerifikasi {
  return {
    bytes: BYTES,
    kandidat: [versiBertanda()],
    kunciInduk: KUNCI_INDUK,
    keyring: { versi: 1, kunci: [K1.entri, K2.entri] },
    kunciDb: [K1.db, K2.db],
    saudara: [{ id: VID, regulationId: RID, status: "SAH", effectiveDate: "2026-01-01" }],
    hariIni: "2026-07-01",
    ...o,
  };
}

function satu(o: Partial<MasukanVerifikasi>): HasilVerifikasi {
  const hasil = verifikasiBerkas(masukan(o));
  expect(hasil).toHaveLength(1);
  return hasil[0];
}

const tidakCocok = (alasan: string) => expect.objectContaining({ hasil: "tidak-cocok", alasan });

describe("positif", () => {
  it("asli-sah: versi berlaku hari ini", () => {
    expect(satu({})).toEqual({
      hasil: "asli-sah",
      alasan: "berlaku",
      versi: { regulasi: "Peraturan Uji", nomorVersi: "2026/1", tanggalBerlaku: "2026-01-01", status: "SAH" },
    });
  });

  it("asli-digantikan: ada versi lebih baru yang sudah berlaku", () => {
    const hasil = satu({
      saudara: [
        { id: VID2, regulationId: RID, status: "SAH", effectiveDate: "2026-06-01" },
        { id: VID, regulationId: RID, status: "SAH", effectiveDate: "2026-01-01" },
      ],
    });
    expect(hasil).toMatchObject({ hasil: "asli-digantikan", alasan: "bukan-berlaku" });
    expect(hasil.versi?.status).toBe("DIGANTIKAN");
  });

  it("versi berlaku di masa depan tetap asli-sah", () => {
    expect(satu({ hariIni: "2025-12-01" })).toMatchObject({ hasil: "asli-sah" });
  });

  it("B-05 kunci DIROTASI tetap sah untuk approvedAt <= dirotasiPada", () => {
    const rotasi = "2026-04-01T00:00:00.000Z";
    const entri: EntriKunci = { ...K1.entri, status: "dirotasi", dirotasiPada: rotasi };
    const db: BarisKunciDb = { ...K1.db, status: "DIROTASI", rotatedAt: new Date(rotasi) };
    expect(satu({ keyring: { versi: 1, kunci: [entri, K2.entri] }, kunciDb: [db, K2.db] })).toMatchObject({
      hasil: "asli-sah",
    });
  });

  it("duplikat sha256: satu hasil per kandidat, kandidat gagal tidak tersembunyi", () => {
    const baik = versiBertanda();
    const rusak = versiBertanda(K1, { id: VID2, versionNumber: "2026/2" }, { fileName: "lain.pdf" });
    const hasil = verifikasiBerkas(
      masukan({
        kandidat: [baik, rusak],
        saudara: [
          { id: VID, regulationId: RID, status: "SAH", effectiveDate: "2026-01-01" },
          { id: VID2, regulationId: RID, status: "SAH", effectiveDate: "2025-01-01" },
        ],
      }),
    );
    expect(hasil.map((h) => h.hasil)).toEqual(["asli-sah", "tidak-cocok"]);
  });
});

describe("negatif: berkas dan status", () => {
  it("berkas tidak dikenal (tanpa kandidat): tanpa metadata versi", () => {
    expect(verifikasiBerkas(masukan({ kandidat: [] }))).toEqual([
      { hasil: "tidak-cocok", alasan: "berkas-tidak-dikenal" },
    ]);
  });

  it("A-06 hanya DRAF/DIBATALKAN yang cocok: hasil SAMA dengan tidak dikenal", () => {
    for (const status of ["DRAF", "DIBATALKAN"]) {
      expect(verifikasiBerkas(masukan({ kandidat: [{ ...versiBertanda(), status }] }))).toEqual(
        verifikasiBerkas(masukan({ kandidat: [] })),
      );
    }
  });

  it("A-06 status DRAF diubah ke SAH tanpa tanda tangan", () => {
    const palsu: KandidatVersi = { ...dasar, status: "SAH", integrityTag: buatTagVersi(KUNCI_INDUK, dataTerlindungDariBaris(dasar)!) };
    expect(satu({ kandidat: [palsu] })).toEqual(tidakCocok("tanpa-tanda-tangan"));
  });

  it("tag HMAC tidak valid", () => {
    expect(satu({ kandidat: [versiBertanda(K1, {}, { integrityTag: `v1$${"0".repeat(64)}` })] })).toEqual(
      tidakCocok("integritas-gagal"),
    );
  });

  it("tag kosong", () => {
    expect(satu({ kandidat: [versiBertanda(K1, {}, { integrityTag: null })] })).toEqual(tidakCocok("integritas-gagal"));
  });

  it("versi SAH seed tanpa signature", () => {
    const seed = versiBertanda(K1, {}, { signature: null, signingKeyId: null, approvedById: null, approvedAt: null });
    expect(satu({ kandidat: [seed] })).toEqual(tidakCocok("tanpa-tanda-tangan"));
  });

  it.each(["signature", "signingKeyId", "approvedById", "approvedAt"] as const)("%s null: tanpa tanda tangan", (f) => {
    expect(satu({ kandidat: [versiBertanda(K1, {}, { [f]: null })] })).toEqual(tidakCocok("tanpa-tanda-tangan"));
  });

  it("hasil tidak-cocok dari kandidat memuat identitas versi tanpa status", () => {
    const hasil = satu({ kandidat: [versiBertanda(K1, {}, { signature: null })] });
    expect(hasil.versi).toEqual({ regulasi: "Peraturan Uji", nomorVersi: "2026/1", tanggalBerlaku: "2026-01-01" });
  });
});

describe("negatif: kunci", () => {
  it("B-06 kunci dicabut", () => {
    const entri: EntriKunci = { ...K1.entri, status: "dicabut", dicabutPada: "2026-05-01T00:00:00.000Z" };
    const db: BarisKunciDb = { ...K1.db, status: "DICABUT", revokedAt: new Date(entri.dicabutPada!) };
    expect(satu({ keyring: { versi: 1, kunci: [entri] }, kunciDb: [db] })).toEqual(tidakCocok("kunci-dicabut"));
  });

  it("approvedAt setelah kunci dirotasi", () => {
    const rotasi = "2026-02-01T00:00:00.000Z";
    const entri: EntriKunci = { ...K1.entri, status: "dirotasi", dirotasiPada: rotasi };
    const db: BarisKunciDb = { ...K1.db, status: "DIROTASI", rotatedAt: new Date(rotasi) };
    expect(satu({ keyring: { versi: 1, kunci: [entri] }, kunciDb: [db] })).toEqual(
      tidakCocok("kunci-dirotasi-sebelum-penandatanganan"),
    );
  });

  it("approvedAt sebelum kunci dibuat", () => {
    const dibuat = "2026-05-01T00:00:00.000Z";
    const entri: EntriKunci = { ...K1.entri, dibuatPada: dibuat };
    const db: BarisKunciDb = { ...K1.db, createdAt: new Date(dibuat) };
    expect(satu({ keyring: { versi: 1, kunci: [entri] }, kunciDb: [db] })).toEqual(tidakCocok("kunci-sebelum-dibuat"));
  });

  it("B-07 kunci ada di tabel tetapi tidak di keyring", () => {
    expect(satu({ keyring: { versi: 1, kunci: [K2.entri] } })).toEqual(tidakCocok("kunci-tidak-sinkron"));
  });

  it("kunci ada di keyring tetapi tidak di tabel", () => {
    expect(satu({ kunciDb: [K2.db] })).toEqual(tidakCocok("kunci-tidak-sinkron"));
  });

  it("kunci publik tabel berbeda dari keyring", () => {
    expect(satu({ kunciDb: [{ ...K1.db, publicKey: K2.db.publicKey }, K2.db] })).toEqual(
      tidakCocok("kunci-tidak-sinkron"),
    );
  });

  it("status tabel berbeda dari keyring", () => {
    expect(satu({ kunciDb: [{ ...K1.db, status: "DIROTASI" }, K2.db] })).toEqual(tidakCocok("kunci-tidak-sinkron"));
  });

  it("status tabel tidak dikenal", () => {
    expect(satu({ kunciDb: [{ ...K1.db, status: "ANEH" }, K2.db] })).toEqual(tidakCocok("kunci-tidak-sinkron"));
  });

  it("rotatedAt tabel berbeda dari dirotasiPada keyring (1 ms)", () => {
    const rotasi = "2026-04-01T00:00:00.000Z";
    const entri: EntriKunci = { ...K1.entri, status: "dirotasi", dirotasiPada: rotasi };
    const db: BarisKunciDb = { ...K1.db, status: "DIROTASI", rotatedAt: new Date(Date.parse(rotasi) + 1) };
    expect(satu({ keyring: { versi: 1, kunci: [entri] }, kunciDb: [db] })).toEqual(tidakCocok("kunci-tidak-sinkron"));
  });

  it("revokedAt tabel berbeda dari dicabutPada keyring (1 ms)", () => {
    const cabut = "2026-05-01T00:00:00.000Z";
    const entri: EntriKunci = { ...K1.entri, status: "dicabut", dicabutPada: cabut };
    const db: BarisKunciDb = { ...K1.db, status: "DICABUT", revokedAt: new Date(Date.parse(cabut) + 1) };
    expect(satu({ keyring: { versi: 1, kunci: [entri] }, kunciDb: [db] })).toEqual(tidakCocok("kunci-tidak-sinkron"));
  });

  it("createdAt tabel berbeda dari dibuatPada keyring -> kunci-tidak-sinkron", () => {
    const db: BarisKunciDb = { ...K1.db, createdAt: new Date(Date.parse(DIBUAT) + 1) };
    expect(satu({ kunciDb: [db, K2.db] })).toEqual(tidakCocok("kunci-tidak-sinkron"));
  });
});

describe("negatif: tanda tangan dan payload", () => {
  it("tanda tangan diubah satu byte", () => {
    const k = versiBertanda();
    const sig = new Uint8Array(k.signature!);
    sig[10] ^= 1;
    expect(satu({ kandidat: [{ ...k, signature: sig }] })).toEqual(tidakCocok("tanda-tangan-tidak-valid"));
  });

  it("tanda tangan panjang bukan 64 byte", () => {
    const k = versiBertanda();
    expect(satu({ kandidat: [{ ...k, signature: k.signature!.slice(0, 63) }] })).toEqual(
      tidakCocok("tanda-tangan-tidak-valid"),
    );
  });

  // Field F-31 diubah dengan tag dihitung ulang agar langkah tanda tangan yang menolaknya.
  it.each([
    ["A-05 effectiveDate", { effectiveDate: new Date("2026-02-02T00:00:00.000Z") }],
    ["A-05 versionNumber", { versionNumber: "2026/9" }],
    ["A-05 fileName", { fileName: "lain.pdf" }],
    ["A-05 fileSize", { fileSize: BYTES.length + 1 }],
  ] as [string, Partial<KandidatVersi>][])("%s diubah", (_n, ubah) => {
    expect(satu({ kandidat: [versiBertanda(K1, {}, ubah, true)] })).toEqual(tidakCocok("tanda-tangan-tidak-valid"));
  });

  it("A-08 approvedById diubah", () => {
    expect(satu({ kandidat: [versiBertanda(K1, {}, { approvedById: UID2 })] })).toEqual(
      tidakCocok("tanda-tangan-tidak-valid"),
    );
  });

  it("A-08 approvedAt diubah (masih dalam masa kunci)", () => {
    expect(satu({ kandidat: [versiBertanda(K1, {}, { approvedAt: new Date("2026-03-04T00:00:00.000Z") })] })).toEqual(
      tidakCocok("tanda-tangan-tidak-valid"),
    );
  });

  it("A-09 signingKeyId diubah ke kunci lain yang terdaftar", () => {
    expect(satu({ kandidat: [versiBertanda(K1, {}, { signingKeyId: K2.entri.id })] })).toEqual(
      tidakCocok("tanda-tangan-tidak-valid"),
    );
  });

  it("A-07 signature + signingKeyId disalin dari versi lain", () => {
    const lain = versiBertanda(K2, { id: VID2, versionNumber: "2026/2" });
    const salinan = versiBertanda(K1, {}, { signature: lain.signature, signingKeyId: lain.signingKeyId });
    expect(satu({ kandidat: [salinan] })).toEqual(tidakCocok("tanda-tangan-tidak-valid"));
  });

  it("galat payload (approvedById bukan UUID) = tidak-cocok, bukan lemparan", () => {
    expect(satu({ kandidat: [versiBertanda(K1, {}, { approvedById: "bukan-uuid" })] })).toEqual(
      tidakCocok("tanda-tangan-tidak-valid"),
    );
  });
});

describe("kerahasiaan hasil", () => {
  it("tidak memuat tanda tangan, kunci, atau tag", () => {
    const k = versiBertanda();
    const teks = JSON.stringify(verifikasiBerkas(masukan({ kandidat: [k] })));
    for (const rahasia of [
      Buffer.from(k.signature!).toString("base64"),
      Buffer.from(k.signature!).toString("hex"),
      K1.entri.kunciPublik,
      Buffer.from(K1.db.publicKey).toString("hex"),
      k.integrityTag!,
    ]) {
      expect(teks).not.toContain(rahasia);
    }
  });
});
