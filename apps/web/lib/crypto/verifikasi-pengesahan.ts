import { PERNAH_DISAHKAN, terapkanStatusTurunan } from "../domain/versi";
import type { VersionStatus } from "../types";
import { dataTerlindungDariBaris } from "./data-terlindung";
import type { AlasanVerifikasi, HasilVerifikasi, MetadataVersi } from "./hasil-verifikasi";
import { cariKunci, kunciBolehMemverifikasi, type EntriKunci, type Keyring } from "./keyring";
import { statusPrismaKeKeyring } from "./operasi-kunci";
import { bangunPayloadPengesahan } from "./payload-pengesahan";
import { verifikasiTandaTangan } from "./tanda-tangan";
import { periksaIntegritasVersi } from "./verifikasi";

// Verifikasi berkas terhadap catatan pengesahan (F-33). MURNI: tanpa DB, env, atau jam;
// semua masukan dari pemanggil. Gagal tertutup di setiap langkah. v1.0 (F-44) memakai fungsi yang sama.

export interface KandidatVersi {
  id: string;
  regulationId: string;
  namaRegulasi: string;
  versionNumber: string;
  effectiveDate: Date;
  status: string;
  fileSha256: string | null;
  fileName: string | null;
  fileSize: number | null;
  integrityTag: string | null;
  signature: Uint8Array | null;
  signingKeyId: string | null;
  approvedById: string | null;
  approvedAt: Date | null;
}

export interface BarisKunciDb {
  id: string;
  publicKey: Uint8Array;
  status: string;
  createdAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
}

/** Semua versi regulasi yang relevan (termasuk kandidat) untuk aturan F-03. */
export interface SaudaraVersi {
  id: string;
  regulationId: string;
  status: VersionStatus;
  /** ISO "YYYY-MM-DD". */
  effectiveDate: string;
}

export interface MasukanVerifikasi {
  bytes: Uint8Array;
  /** Versi dengan fileSha256 sama dengan berkas; penyaringan status dilakukan di sini. */
  kandidat: readonly KandidatVersi[];
  kunciInduk: Uint8Array;
  keyring: Keyring;
  kunciDb: readonly BarisKunciDb[];
  saudara: readonly SaudaraVersi[];
  /** ISO "YYYY-MM-DD" (WIB). */
  hariIni: string;
}

const tanggalIso = (d: Date) => d.toISOString().slice(0, 10);

function samaWaktu(db: Date | null, iso: string | null): boolean {
  if (db === null || iso === null) return db === null && iso === null;
  return db.getTime() === Date.parse(iso);
}

/** Keyring adalah akar kepercayaan; tabel harus sama persis. Galat apa pun (mis. status tak dikenal) = tidak sinkron. */
function kunciSinkron(entri: EntriKunci, baris: BarisKunciDb | undefined): boolean {
  if (!baris) return false;
  try {
    return (
      Buffer.from(baris.publicKey).equals(Buffer.from(entri.kunciPublik, "base64")) &&
      statusPrismaKeKeyring(baris.status) === entri.status &&
      samaWaktu(baris.createdAt, entri.dibuatPada) &&
      samaWaktu(baris.rotatedAt, entri.dirotasiPada) &&
      samaWaktu(baris.revokedAt, entri.dicabutPada)
    );
  } catch {
    return false;
  }
}

function tandaTanganValid(k: KandidatVersi, entri: EntriKunci, signature: Uint8Array, signingKeyId: string, approvedById: string, approvedAt: Date): boolean {
  try {
    const data = dataTerlindungDariBaris({
      id: k.id,
      regulationId: k.regulationId,
      versionNumber: k.versionNumber,
      effectiveDate: k.effectiveDate,
      fileSha256: k.fileSha256,
      fileName: k.fileName,
      fileSize: k.fileSize,
    });
    if (!data) return false;
    const payload = bangunPayloadPengesahan({ ...data, approvedById, approvedAt, signingKeyId });
    return verifikasiTandaTangan(payload, signature, Buffer.from(entri.kunciPublik, "base64"));
  } catch {
    return false;
  }
}

function integritasLolos(m: MasukanVerifikasi, k: KandidatVersi): boolean {
  try {
    const data = dataTerlindungDariBaris({
      id: k.id,
      regulationId: k.regulationId,
      versionNumber: k.versionNumber,
      effectiveDate: k.effectiveDate,
      fileSha256: k.fileSha256,
      fileName: k.fileName,
      fileSize: k.fileSize,
    });
    if (!data) return false;
    periksaIntegritasVersi({ kunciInduk: m.kunciInduk, data, tag: k.integrityTag, bytes: m.bytes });
    return true;
  } catch {
    return false;
  }
}

function periksaKandidat(m: MasukanVerifikasi, k: KandidatVersi): HasilVerifikasi {
  const versi: MetadataVersi = {
    regulasi: k.namaRegulasi,
    nomorVersi: k.versionNumber,
    tanggalBerlaku: tanggalIso(k.effectiveDate),
  };
  const tolak = (alasan: AlasanVerifikasi): HasilVerifikasi => ({ hasil: "tidak-cocok", alasan, versi });

  if (!integritasLolos(m, k)) return tolak("integritas-gagal");

  const { signature, signingKeyId, approvedById, approvedAt } = k;
  if (!signature || !signingKeyId || !approvedById || !approvedAt) return tolak("tanpa-tanda-tangan");

  const entri = cariKunci(m.keyring, signingKeyId);
  if (!entri || !kunciSinkron(entri, m.kunciDb.find((b) => b.id === signingKeyId))) {
    return tolak("kunci-tidak-sinkron");
  }

  const boleh = kunciBolehMemverifikasi(entri, approvedAt);
  if (!boleh.boleh) return tolak(`kunci-${boleh.alasan}` as AlasanVerifikasi);

  if (!tandaTanganValid(k, entri, signature, signingKeyId, approvedById, approvedAt)) {
    return tolak("tanda-tangan-tidak-valid");
  }

  const turunan = terapkanStatusTurunan(
    m.saudara.filter((s) => s.regulationId === k.regulationId),
    m.hariIni,
  ).find((s) => s.id === k.id);
  if (!turunan) throw new Error("Daftar versi regulasi tidak memuat kandidat.");
  return turunan.status === "DIGANTIKAN"
    ? { hasil: "asli-digantikan", alasan: "bukan-berlaku", versi: { ...versi, status: "DIGANTIKAN" } }
    : { hasil: "asli-sah", alasan: "berlaku", versi: { ...versi, status: "SAH" } };
}

/**
 * Satu hasil per kandidat yang pernah disahkan (SAH/DIGANTIKAN); tidak ada agregasi, jadi
 * kandidat gagal tidak tersembunyi di balik kandidat lolos. Tanpa kandidat: satu hasil
 * berkas-tidak-dikenal. DRAF/DIBATALKAN dibuang di sini sehingga keberadaannya tidak bocor.
 */
export function verifikasiBerkas(masukan: MasukanVerifikasi): HasilVerifikasi[] {
  const kandidat = masukan.kandidat.filter((k) => (PERNAH_DISAHKAN as readonly string[]).includes(k.status));
  if (kandidat.length === 0) return [{ hasil: "tidak-cocok", alasan: "berkas-tidak-dikenal" }];
  return kandidat.map((k) => periksaKandidat(masukan, k));
}
