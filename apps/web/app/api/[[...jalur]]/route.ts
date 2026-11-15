import { buatMasalah } from "@/lib/api/masalah";

// Sengaja tanpa jagaRoute dan periksaOrigin: jalur tak dikenal dijawab 404
// seragam untuk anonim maupun pengguna masuk, sehingga keberadaan jalur tidak bocor.
// Segmen yang lebih spesifik (auth/[...all], v1/...) tetap diutamakan oleh router.
function tidakDikenal(request: Request): Response {
  return buatMasalah("not-found", request, { detail: "Sumber daya tidak ditemukan." });
}

export {
  tidakDikenal as GET,
  tidakDikenal as POST,
  tidakDikenal as PUT,
  tidakDikenal as PATCH,
  tidakDikenal as DELETE,
};
