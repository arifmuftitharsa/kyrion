import type { z } from "zod";
import type { GalatField } from "@/lib/api/masalah";
import { findEffectiveVersion } from "@/lib/domain/versi";
import { skemaQueryRegulasi } from "@/lib/skema";
import type { Regulation, VersionStatus } from "@/lib/types";

// Fungsi murni untuk GET /api/v1/regulations: membaca query, menyusun galat field,
// dan memetakan data ke bentuk respons. Tanpa akses data, jam, atau server-only.

/** Validasi query ketat; key yang berulang dikirim sebagai array agar ditolak skema. */
export function bacaQueryRegulasi(params: URLSearchParams) {
  // Object.fromEntries selalu membuat properti biasa, termasuk untuk kunci "__proto__",
  // sehingga kunci itu tetap terlihat oleh skema dan ditolak sebagai parameter tak dikenal.
  const mentah = Object.fromEntries(
    [...new Set(params.keys())].map((key) => {
      const nilai = params.getAll(key);
      return [key, nilai.length > 1 ? nilai : nilai[0]];
    }),
  );
  return skemaQueryRegulasi.safeParse(mentah);
}

/** Satu GalatField per masalah; field selalu string ("query" bila tak ada path). */
export function susunGalatField(error: z.ZodError): GalatField[] {
  return error.issues.flatMap((issue): GalatField[] => {
    if (issue.code === "unrecognized_keys") {
      return issue.keys.map((key) => ({ field: key, message: "Parameter tidak dikenal" }));
    }
    return [{ field: String(issue.path[0] ?? "query"), message: issue.message }];
  });
}

export type RingkasanRegulasi = {
  slug: string;
  name: string;
  category: string;
  description: string | null;
  currentVersion: {
    id: string;
    versionNumber: string;
    effectiveDate: string;
    status: VersionStatus;
  } | null;
};

/** Versi berlaku dihitung oleh findEffectiveVersion; daftar versi lengkap tidak ikut. */
export function petakanRegulasi(
  daftar: readonly Regulation[],
  hariIni: string,
): RingkasanRegulasi[] {
  return daftar.map(({ slug, name, category, description, versions }) => {
    const berlaku = findEffectiveVersion(versions, hariIni);
    return {
      slug,
      name,
      category,
      description,
      currentVersion: berlaku
        ? {
            id: berlaku.id,
            versionNumber: berlaku.versionNumber,
            effectiveDate: berlaku.effectiveDate,
            status: berlaku.status,
          }
        : null,
    };
  });
}
