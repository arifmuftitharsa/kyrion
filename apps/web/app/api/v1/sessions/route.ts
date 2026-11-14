import { jagaRoute } from "@/lib/akses/jaga-route";
import { buatMasalah } from "@/lib/api/masalah";
import { petakanSesi } from "@/lib/api/sesi";
import { daftarSesiAktif } from "@/lib/data/sesi";

// Endpoint 5: sesi aktif milik sendiri. Token, ipAddress, dan userAgent tidak pernah dipilih
// di query maupun dikirim.
export async function GET(request: Request): Promise<Response> {
  const jaga = await jagaRoute("masuk", request, "problem");
  if ("respons" in jaga) return jaga.respons;
  const { sesi } = jaga;

  try {
    const baris = await daftarSesiAktif(sesi.userId, new Date());
    return Response.json(
      { data: baris.map((b) => petakanSesi(b, sesi.sesiId)) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    // Hanya nama galat yang dicatat: pesan atau stack bisa membawa jejak data.
    console.error("Galat daftar sesi:", error instanceof Error ? error.name : "galat tidak dikenal");
    return buatMasalah("internal-error", request);
  }
}
