import { getAdminRegulationBySlug } from "@/lib/data/regulations";
import { findVersionFile } from "@/lib/data/versions";
import { skemaParamBerkas } from "@/lib/skema";
import { jagaRoute } from "@/lib/akses/jaga-route";
import { responsPdf, tidakDitemukan } from "@/lib/unduhan-pdf";

// Unduhan admin: semua status, termasuk Draf. Anonim 401, Sivitas 403 (tanpa redirect),
// dan versi harus milik regulasi pada URL.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; versionId: string }> },
) {
  const jaga = await jagaRoute("admin", request, "teks");
  if ("respons" in jaga) return jaga.respons;

  const parsed = skemaParamBerkas.safeParse(await params);
  if (!parsed.success) return tidakDitemukan();

  const regulasi = await getAdminRegulationBySlug(parsed.data.slug);
  if (!regulasi) return tidakDitemukan();

  const berkas = await findVersionFile(regulasi.id, parsed.data.versionId);
  return berkas ? responsPdf(berkas) : tidakDitemukan();
}
