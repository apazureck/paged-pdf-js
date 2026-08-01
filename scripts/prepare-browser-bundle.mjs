import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const sourcePath = resolve(projectRoot, "dist", "paged-pdf.min.js");
const browserRoot = resolve(projectRoot, "browser");
const targetPath = resolve(browserRoot, "paged-pdf.min.js");
const sourceBundle = await readFile(sourcePath, "utf8");
const standaloneBundle = sourceBundle.replace(
  /\r?\n?\/\/# sourceMappingURL=[^\r\n]+(?:\r?\n)?$/u,
  "\n"
);

await mkdir(browserRoot, { recursive: true });
await writeFile(targetPath, standaloneBundle, "utf8");

console.log("Prepared browser/paged-pdf.min.js for direct download.");
