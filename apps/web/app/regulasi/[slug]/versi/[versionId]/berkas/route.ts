import { findPublicVersionFile } from "@/lib/data/regulations";
import { skemaParamBerkas } from "@/lib/skema";
import { responsPdf, tidakDitemukan } from "@/lib/unduhan-pdf";

// Unduhan publik (F-05): hanya versi Sah/Digantikan; Draf dan Dibatalkan 404.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; versionId: string }> },
) {
  const parsed = skemaParamBerkas.safeParse(await params);
  if (!parsed.success) return tidakDitemukan();

  const berkas = await findPublicVersionFile(parsed.data.slug, parsed.data.versionId);
  return berkas ? responsPdf(berkas) : tidakDitemukan();
}
