import { defineConfig } from "vitest/config";

// Alias "@/" dibaca dari "paths" di tsconfig.json (fitur bawaan Vite, tanpa paket tambahan).
export default defineConfig({
  resolve: { tsconfigPaths: true },
});
