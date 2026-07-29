import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { defineConfig, type Plugin } from "vite";

interface PackageMetadata {
  readonly version: string;
}

const demoRoot = resolve(import.meta.dirname, "demo");
const packageMetadata = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "package.json"), "utf8")
) as PackageMetadata;
const pagedDomDeclaration = `declare function pagedDomToPdf(
  root: ParentNode,
  options?: PagedDomToPdfOptions
): Promise&lt;PdfResult&gt;;

interface PdfResult {`;

function manualTemplatePlugin(): Plugin {
  return {
    name: "paged-pdf-manual-template",
    transformIndexHtml(html) {
      return html
        .replaceAll("__PACKAGE_VERSION__", packageMetadata.version)
        .replace("interface PdfResult {", pagedDomDeclaration);
    }
  };
}

export default defineConfig({
  root: demoRoot,
  plugins: [manualTemplatePlugin()],
  build: {
    outDir: resolve(import.meta.dirname, "demo-dist"),
    emptyOutDir: true,
    rollupOptions: {
      external: ["canvg", "dompurify", "html2canvas"],
      input: {
        gallery: resolve(demoRoot, "gallery.html"),
        manual: resolve(demoRoot, "manual.html"),
        pagedPreview: resolve(demoRoot, "paged-preview.html"),
        playground: resolve(demoRoot, "index.html")
      }
    },
    sourcemap: true
  }
});
