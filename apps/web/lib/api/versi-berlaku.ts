import { kumpulkanQuery, petakanVersiBerlaku } from "@/lib/api/daftar-regulasi";
import type { VersiBerlaku } from "@/lib/api/daftar-regulasi";
import { skemaQueryVersiBerlaku } from "@/lib/skema";
import type { Regulation } from "@/lib/types";

// Fungsi murni untuk GET /api/v1/regulations/{slug}/current-version. Tanpa akses data, jam, atau server-only.

/** Query ketat: hanya `date` (opsional, tanggal kalender sah YYYY-MM-DD). */
export function bacaQueryVersiBerlaku(params: URLSearchParams) {
  return skemaQueryVersiBerlaku.safeParse(kumpulkanQuery(params));
}

export type VersiBerlakuPadaTanggal = {
  slug: string;
  date: string;
  currentVersion: VersiBerlaku | null;
};

/** `date` adalah tanggal acuan yang benar-benar dipakai; versi dipilih oleh findEffectiveVersion. */
export function petakanVersiBerlakuPadaTanggal(
  regulasi: Regulation,
  date: string,
): VersiBerlakuPadaTanggal {
  return {
    slug: regulasi.slug,
    date,
    currentVersion: petakanVersiBerlaku(regulasi.versions, date),
  };
}
