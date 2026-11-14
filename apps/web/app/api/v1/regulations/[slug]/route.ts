import { jagaRoute } from "@/lib/akses/jaga-route";
import { susunGalatField } from "@/lib/api/daftar-regulasi";
import { bacaQueryKosong, petakanDetailRegulasi } from "@/lib/api/detail-regulasi";
import { buatMasalah } from "@/lib/api/masalah";
import { getRegulationBySlug } from "@/lib/data/regulations";
import { todayInJakarta } from "@/lib/domain/tanggal";
import { skemaSlugRegulasi } from "@/lib/skema";

// F-02: detail satu regulasi beserta linimasa versinya.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const jaga = await jagaRoute("masuk", request, "problem");
  if ("respons" in jaga) return jaga.respons;
  const { slug } = await params;

  // Slug berformat salah diperlakukan sama dengan slug yang tidak ada.
  const tidakDitemukan = () =>
    buatMasalah("not-found", request, { detail: "Regulasi tidak ditemukan." });
  if (!skemaSlugRegulasi.safeParse(slug).success) return tidakDitemukan();

  const query = bacaQueryKosong(new URL(request.url).searchParams);
  if (!query.success) {
    return buatMasalah("validation-error", request, {
      detail: "Parameter query tidak valid.",
      errors: susunGalatField(query.error),
    });
  }

  try {
    const regulasi = await getRegulationBySlug(slug);
    if (!regulasi) return tidakDitemukan();
    return Response.json(
      { data: petakanDetailRegulasi(regulasi, todayInJakarta(new Date())) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    // Hanya nama galat yang dicatat: pesan atau stack bisa membawa jejak data.
    console.error(
      "Galat detail regulasi:",
      error instanceof Error ? error.name : "galat tidak dikenal",
    );
    return buatMasalah("internal-error", request);
  }
}
