import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: resolve(import.meta.dirname, "demo"),
  build: {
    outDir: resolve(import.meta.dirname, "demo-dist"),
    emptyOutDir: true,
    rollupOptions: {
      external: ["canvg", "dompurify", "html2canvas"]
    },
    sourcemap: true
  }
});
