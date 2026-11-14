import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  poweredByHeader: false,
  // Header keamanan dasar untuk semua rute (OWASP A02). Lapisan tambahan, bukan pengganti otorisasi.
  // CSP sengaja belum ada: butuh rancangan nonce untuk Next, dikerjakan bila waktu ada.
  // HSTS sengaja belum ada: hanya bermakna di atas HTTPS publik, diputuskan saat deployment,
  // dan tidak boleh dikirim dari server HTTP lokal.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    // PDF maks. 10 MB (MAX_INPUT_BYTES) + overhead multipart; batas 10 MB yang
    // sebenarnya ditegakkan oleh validasiBerkasPdf di server.
    serverActions: { bodySizeLimit: "11mb" },
    // proxy.ts mencocokkan semua halaman kecuali /masuk, /api, dan aset, serta menyangga body request (bawaan 10 MB).
    proxyClientMaxBodySize: "11mb",
  },
};

export default nextConfig;
