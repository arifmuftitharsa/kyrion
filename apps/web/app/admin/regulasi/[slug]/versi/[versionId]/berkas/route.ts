import { getAdminRegulationBySlug } from "@/lib/data/regulations";
import { findVersionFile } from "@/lib/data/versions";
import { skemaParamBerkas } from "@/lib/skema";
import { wajibAdmin } from "@/lib/sesi";
import { responsPdf, tidakDitemukan } from "@/lib/unduhan-pdf";

// Unduhan admin: semua status, termasuk Draf. wajibAdmin() dipanggil di luar try
// (redirect() bekerja dengan melempar), dan versi harus milik regulasi pada URL.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; versionId: string }> },
) {
  await wajibAdmin();

  const parsed = skemaParamBerkas.safeParse(await params);
  if (!parsed.success) return tidakDitemukan();

  const regulasi = await getAdminRegulationBySlug(parsed.data.slug);
  if (!regulasi) return tidakDitemukan();

  const berkas = await findVersionFile(regulasi.id, parsed.data.versionId);
  return berkas ? responsPdf(berkas) : tidakDitemukan();
}
