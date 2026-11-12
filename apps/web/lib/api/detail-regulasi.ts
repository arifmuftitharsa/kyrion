import { kumpulkanQuery, petakanVersiBerlaku } from "@/lib/api/daftar-regulasi";
import type { RingkasanRegulasi } from "@/lib/api/daftar-regulasi";
import { sortVersionsNewestFirst } from "@/lib/domain/versi";
import { skemaQueryTanpaParam } from "@/lib/skema";
import type { Regulation } from "@/lib/types";

// Fungsi murni untuk GET /api/v1/regulations/{slug}. Tanpa akses data, jam, atau server-only.

/** Endpoint ini tidak menerima parameter query: setiap kunci ditolak sebagai tak dikenal. */
export function bacaQueryKosong(params: URLSearchParams) {
  return skemaQueryTanpaParam.safeParse(kumpulkanQuery(params));
}

export type DetailRegulasi = RingkasanRegulasi & {
  versions: {
    id: string;
    versionNumber: string;
    effectiveDate: string;
    status: Regulation["versions"][number]["status"];
    changeSummary: string | null;
    fileSize: number | null;
  }[];
};

/** Linimasa diurutkan dari terbaru; currentVersion memakai aturan yang sama dengan daftar. */
export function petakanDetailRegulasi(regulasi: Regulation, hariIni: string): DetailRegulasi {
  const { slug, name, category, description, versions } = regulasi;
  return {
    slug,
    name,
    category,
    description,
    currentVersion: petakanVersiBerlaku(versions, hariIni),
    versions: sortVersionsNewestFirst(versions).map(
      ({ id, versionNumber, effectiveDate, status, changeSummary, fileSize }) => ({
        id,
        versionNumber,
        effectiveDate,
        status,
        changeSummary,
        fileSize,
      }),
    ),
  };
}
