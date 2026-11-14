import { jagaRoute } from "@/lib/akses/jaga-route";
import { buatMasalah } from "@/lib/api/masalah";
import { periksaOrigin } from "@/lib/api/origin";
import { cabutSesi } from "@/lib/data/sesi";
import { skemaIdSesi } from "@/lib/skema";

// Endpoint 6: mencabut sesi milik sendiri (termasuk yang sedang dipakai, sama dengan keluar).
// Sesi orang lain dan sesi yang tidak ada sama-sama 404; pemilik ada di where penghapusan.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const tolakOrigin = periksaOrigin(request);
    if (tolakOrigin) return tolakOrigin;
    const jaga = await jagaRoute("masuk", request, "problem");
    if ("respons" in jaga) return jaga.respons;

    const { id } = await params;
    const tidakDitemukan = () => buatMasalah("not-found", request, { detail: "Sesi tidak ditemukan." });
    if (!skemaIdSesi.safeParse(id).success) return tidakDitemukan();
    if (!(await cabutSesi(id, jaga.sesi.userId))) return tidakDitemukan();

    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // Hanya nama galat yang dicatat: pesan atau stack bisa membawa jejak data.
    console.error("Galat cabut sesi:", error instanceof Error ? error.name : "galat tidak dikenal");
    return buatMasalah("internal-error", request);
  }
}
