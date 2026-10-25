// Perbandingan perubahan antarversi (F-04, alur 6.3): fungsi murni, tanpa akses data.
// Import relatif: Vitest berjalan tanpa config alias "@/".
import type { ChangeSource, VersionStatus } from "../types";
import { PERNAH_DISAHKAN } from "./versi";

export interface PerubahanRingkas {
  id: string;
  description: string;
  source: ChangeSource;
  page: number | null;
}

export interface VersiBanding {
  id: string;
  versionNumber: string;
  /** Tanggal berlaku ISO "YYYY-MM-DD". */
  effectiveDate: string;
  status: VersionStatus;
  perubahan: PerubahanRingkas[];
}

export type GalatBanding = "VERSI_SAMA" | "TIDAK_DITEMUKAN";

export type HasilBanding =
  | {
      ok: true;
      dari: VersiBanding;
      ke: VersiBanding;
      /** True bila pemanggil memberi urutan terbalik dan hasil ditukar. */
      ditukar: boolean;
      kelompok: { versi: VersiBanding; perubahan: PerubahanRingkas[] }[];
    }
  | { ok: false; galat: GalatBanding };

/**
 * Perubahan pada versi SESUDAH `dariId` sampai DENGAN `keId`, dikelompokkan per versi
 * (versi tengah ikut). Hanya versi SAH/DIGANTIKAN yang dikenal; id lain, termasuk
 * Draf dan Dibatalkan, sama saja dengan tidak ditemukan agar keberadaan Draf tidak bocor.
 * Urutan terbalik ditukar otomatis. Posisi diambil dari indeks hasil sort stabil
 * (tanggal berlaku naik), jadi dua versi bertanggal sama tetap tidak ambigu.
 */
export function perubahanAntaraVersi(
  versi: readonly VersiBanding[],
  dariId: string,
  keId: string,
): HasilBanding {
  if (dariId === keId) return { ok: false, galat: "VERSI_SAMA" };

  const urut = versi
    .filter((v) => PERNAH_DISAHKAN.includes(v.status))
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  const indeksDari = urut.findIndex((v) => v.id === dariId);
  const indeksKe = urut.findIndex((v) => v.id === keId);
  if (indeksDari < 0 || indeksKe < 0) return { ok: false, galat: "TIDAK_DITEMUKAN" };

  const ditukar = indeksDari > indeksKe;
  const [awal, akhir] = ditukar ? [indeksKe, indeksDari] : [indeksDari, indeksKe];
  return {
    ok: true,
    dari: urut[awal],
    ke: urut[akhir],
    ditukar,
    kelompok: urut.slice(awal + 1, akhir + 1).map((v) => ({ versi: v, perubahan: v.perubahan })),
  };
}
