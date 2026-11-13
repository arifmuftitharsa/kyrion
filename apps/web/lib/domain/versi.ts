// Aturan domain versi regulasi: fungsi murni, tanpa akses data maupun jam,
// sehingga input sama selalu menghasilkan output sama dan mudah diuji.
import type { Version, VersionStatus } from "@/lib/types";

/** Bentuk minimal versi untuk aturan di file ini; effectiveDate ISO "YYYY-MM-DD" (bukan Date). */
interface StatusDanTanggal {
  status: VersionStatus;
  effectiveDate: string;
}

/** Status versi yang pernah disahkan; hanya ini yang ditampilkan ke publik (F-02). */
export const PERNAH_DISAHKAN: readonly VersionStatus[] = ["SAH", "DIGANTIKAN"];

/**
 * Versi yang berlaku pada `onDate` (ISO "YYYY-MM-DD"): di antara versi yang
 * pernah disahkan (SAH atau DIGANTIKAN) dengan tanggal berlaku <= `onDate`,
 * ambil yang tanggal berlakunya paling akhir. DRAF dan DIBATALKAN tidak dihitung.
 * Mengembalikan `undefined` bila tidak ada versi berlaku.
 *
 * Perbandingan memakai string ISO karena format "YYYY-MM-DD" terurut secara
 * leksikografis, sehingga bebas dari pergeseran zona waktu.
 *
 * Tanggal berlaku sama: versi yang muncul lebih dulu di `versions` dipertahankan
 * (lib/data mengurutkan effectiveDate desc, createdAt desc). Kini hanya cadangan:
 * pengesahan menolak tanggal kembar, tetapi dua pengesahan bersamaan atas dua
 * Draf bertanggal sama masih bisa lolos, dan penentu seri ini yang menanganinya.
 */
export function findEffectiveVersion<T extends StatusDanTanggal>(
  versions: readonly T[],
  onDate: string,
): T | undefined {
  return versions
    .filter(
      (version) =>
        PERNAH_DISAHKAN.includes(version.status) &&
        version.effectiveDate <= onDate,
    )
    .reduce<T | undefined>(
      (latest, version) =>
        !latest || version.effectiveDate > latest.effectiveDate ? version : latest,
      undefined,
    );
}

/**
 * Label status yang ditampilkan untuk semua versi SATU regulasi pada `today`
 * (ISO "YYYY-MM-DD"). Status tersimpan SAH dan DIGANTIKAN diperlakukan sama:
 * versi berlaku (findEffectiveVersion) berlabel SAH, versi pernah disahkan lain
 * yang tanggal berlakunya <= `today` berlabel DIGANTIKAN, yang di masa depan SAH.
 * DRAF dan DIBATALKAN tidak diubah. Mengembalikan salinan; urutan dipertahankan.
 */
export function terapkanStatusTurunan<T extends StatusDanTanggal>(
  versions: readonly T[],
  today: string,
): T[] {
  const berlaku = findEffectiveVersion(versions, today);
  return versions.map((version) => {
    if (!PERNAH_DISAHKAN.includes(version.status)) return { ...version };
    const status: VersionStatus =
      version === berlaku || version.effectiveDate > today ? "SAH" : "DIGANTIKAN";
    return { ...version, status };
  });
}

/**
 * Mengurutkan versi dari yang terbaru. Membuat salinan array agar data
 * sumber tidak ikut berubah. Sort stabil, jadi urutan tie-break dari
 * lib/data tetap terjaga.
 */
export function sortVersionsNewestFirst(versions: readonly Version[]): Version[] {
  return [...versions].sort((a, b) =>
    b.effectiveDate.localeCompare(a.effectiveDate),
  );
}
