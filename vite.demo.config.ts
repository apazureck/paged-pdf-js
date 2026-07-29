import { resolve } from "node:path";
import { defineConfig } from "vite";

const demoRoot = resolve(import.meta.dirname, "demo");

export default defineConfig({
  root: demoRoot,
  build: {
    outDir: resolve(import.meta.dirname, "demo-dist"),
    emptyOutDir: true,
    rollupOptions: {
      external: ["canvg", "dompurify", "html2canvas"],
      input: {
        gallery: resolve(demoRoot, "gallery.html"),
        pagedPreview: resolve(demoRoot, "paged-preview.html"),
        playground: resolve(demoRoot, "index.html")
      }
    },
    sourcemap: true
  }
});
