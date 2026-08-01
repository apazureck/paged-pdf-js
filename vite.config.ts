import { resolve } from "node:path";

import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    dts({
      entryRoot: "src",
      include: ["src"],
      outDirs: ["dist"],
      bundleTypes: true
    })
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    lib: {
      entry: resolve(import.meta.dirname, "src/index.ts"),
      name: "PagedPdf",
      formats: ["es", "umd", "cjs"],
      fileName: (format) => {
        if (format === "umd") {
          return "paged-pdf.min.js";
        }
        if (format === "cjs") {
          return "paged-pdf.cjs";
        }
        return "paged-pdf.js";
      }
    },
    rollupOptions: {
      external: ["canvg", "dompurify"],
      output: {
        exports: "named",
        inlineDynamicImports: true
      }
    },
    minify: "esbuild",
    sourcemap: true
  }
});
