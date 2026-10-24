// Aturan domain versi regulasi: fungsi murni, tanpa akses data maupun jam,
// sehingga input sama selalu menghasilkan output sama dan mudah diuji.
import type { Version, VersionStatus } from "@/lib/types";

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
 * (lib/data mengurutkan effectiveDate desc, createdAt desc). Ini tie-break
 * sementara; keputusan final ditunda ke v0.3 saat pengesahan (F-13) dibangun.
 */
export function findEffectiveVersion(
  versions: readonly Version[],
  onDate: string,
): Version | undefined {
  return versions
    .filter(
      (version) =>
        PERNAH_DISAHKAN.includes(version.status) &&
        version.effectiveDate <= onDate,
    )
    .reduce<Version | undefined>(
      (latest, version) =>
        !latest || version.effectiveDate > latest.effectiveDate ? version : latest,
      undefined,
    );
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
