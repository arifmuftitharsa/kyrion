import { susunGalatField } from "@/lib/api/daftar-regulasi";
import { buatMasalah } from "@/lib/api/masalah";
import { bacaQueryVersiBerlaku, petakanVersiBerlakuPadaTanggal } from "@/lib/api/versi-berlaku";
import { getRegulationBySlug } from "@/lib/data/regulations";
import { todayInJakarta } from "@/lib/domain/tanggal";
import { skemaSlugRegulasi } from "@/lib/skema";

// F-03: versi regulasi yang berlaku pada tanggal acuan (default: hari ini WIB).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  // Pemeriksaan sesi (401) menyusul di tahap lain.
  const { slug } = await params;

  // Slug berformat salah diperlakukan sama dengan slug yang tidak ada, dan diutamakan atas query.
  const tidakDitemukan = () =>
    buatMasalah("not-found", request, { detail: "Regulasi tidak ditemukan." });
  if (!skemaSlugRegulasi.safeParse(slug).success) return tidakDitemukan();

  const query = bacaQueryVersiBerlaku(new URL(request.url).searchParams);
  if (!query.success) {
    return buatMasalah("validation-error", request, {
      detail: "Parameter query tidak valid.",
      errors: susunGalatField(query.error),
    });
  }

  try {
    const regulasi = await getRegulationBySlug(slug);
    if (!regulasi) return tidakDitemukan();
    const date = query.data.date ?? todayInJakarta(new Date());
    return Response.json(
      { data: petakanVersiBerlakuPadaTanggal(regulasi, date) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    // Hanya nama galat yang dicatat: pesan atau stack bisa membawa jejak data.
    console.error(
      "Galat versi berlaku:",
      error instanceof Error ? error.name : "galat tidak dikenal",
    );
    return buatMasalah("internal-error", request);
  }
}
