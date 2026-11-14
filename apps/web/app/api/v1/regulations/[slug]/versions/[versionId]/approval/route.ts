import { revalidatePath } from "next/cache";
import { jagaRoute } from "@/lib/akses/jaga-route";
import { buatMasalah } from "@/lib/api/masalah";
import { periksaOrigin } from "@/lib/api/origin";
import { getAdminRegulationBySlug } from "@/lib/data/regulations";
import { findVersion, getPenandaVersi, sahkanVersiDenganAudit } from "@/lib/data/versions";
import {
  PESAN_TANGGAL_KEMBAR,
  PESAN_TANPA_BERKAS,
  VersionEffectiveDateTakenError,
  VersionNotEditableError,
  VersionWithoutFileError,
} from "@/lib/domain/versi-admin";
import { skemaIdVersi, skemaSlugRegulasi } from "@/lib/skema";

const DETAIL_BUKAN_DRAF = "Versi bukan Draf atau sudah berubah.";

// Endpoint 4: pengesahan versi. Tanpa body dan tanpa penguncian optimistik dari klien; penanda
// (updatedAt) dibaca di sini, dan pengaman sebenarnya adalah status DRAF di dalam transaksi.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; versionId: string }> },
): Promise<Response> {
  try {
    const tolakOrigin = periksaOrigin(request);
    if (tolakOrigin) return tolakOrigin;
    const jaga = await jagaRoute("admin", request, "problem");
    if ("respons" in jaga) return jaga.respons;

    const { slug, versionId } = await params;
    const tidakDitemukan = (detail: string) => buatMasalah("not-found", request, { detail });
    if (!skemaSlugRegulasi.safeParse(slug).success) return tidakDitemukan("Regulasi tidak ditemukan.");
    if (!skemaIdVersi.safeParse(versionId).success) return tidakDitemukan("Versi tidak ditemukan.");

    const regulasi = await getAdminRegulationBySlug(slug);
    if (!regulasi) return tidakDitemukan("Regulasi tidak ditemukan.");
    // Penanda dibaca SEBELUM versi: bila versi berubah di antaranya, penanda basi dan pengesahan gagal aman.
    const penanda = await getPenandaVersi(regulasi.id, versionId);
    const versi = await findVersion(regulasi.id, versionId);
    if (!penanda || !versi) return tidakDitemukan("Versi tidak ditemukan.");

    try {
      await sahkanVersiDenganAudit({
        regulasi,
        versi,
        penanda: new Date(penanda),
        admin: { id: jaga.sesi.userId },
      });
    } catch (e) {
      const konflik = (detail: string) => buatMasalah("state-conflict", request, { detail });
      if (e instanceof VersionNotEditableError) return konflik(DETAIL_BUKAN_DRAF);
      if (e instanceof VersionWithoutFileError) return konflik(PESAN_TANPA_BERKAS);
      if (e instanceof VersionEffectiveDateTakenError) return konflik(PESAN_TANGGAL_KEMBAR);
      throw e;
    }

    revalidatePath("/", "layout");
    return Response.json(
      { data: { id: versi.id, status: "SAH" } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    // Hanya nama galat yang dicatat: pesan atau stack bisa membawa jejak data.
    console.error("Galat pengesahan versi:", error instanceof Error ? error.name : "galat tidak dikenal");
    return buatMasalah("internal-error", request);
  }
}
