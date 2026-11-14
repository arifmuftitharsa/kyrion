import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
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
