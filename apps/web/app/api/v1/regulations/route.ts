import { bacaQueryRegulasi, petakanRegulasi, susunGalatField } from "@/lib/api/daftar-regulasi";
import { buatMasalah } from "@/lib/api/masalah";
import { getRegulationsByCategory } from "@/lib/data/regulations";
import { todayInJakarta } from "@/lib/domain/tanggal";

// F-01: daftar regulasi beserta versi yang berlaku hari ini.
export async function GET(request: Request): Promise<Response> {
  // Pemeriksaan sesi (401) menyusul di tahap lain.
  const query = bacaQueryRegulasi(new URL(request.url).searchParams);
  if (!query.success) {
    return buatMasalah("validation-error", request, {
      detail: "Parameter query tidak valid.",
      errors: susunGalatField(query.error),
    });
  }

  try {
    const daftar = await getRegulationsByCategory(query.data.category);
    return Response.json(
      { data: petakanRegulasi(daftar, todayInJakarta(new Date())) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    // Hanya nama galat yang dicatat: pesan atau stack bisa membawa jejak data.
    console.error(
      "Galat daftar regulasi:",
      error instanceof Error ? error.name : "galat tidak dikenal",
    );
    return buatMasalah("internal-error", request);
  }
}
