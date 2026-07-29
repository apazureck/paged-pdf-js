import { expect, test } from "@playwright/test";
import { execFile } from "node:child_process";
import {
  copyFile,
  mkdtemp,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

test("ships one self-contained compilable declaration download", async () => {
  const fixtureDirectory = await mkdtemp(join(tmpdir(), "paged-pdf-types-"));

  try {
    await copyFile(
      resolve("demo", "public", "downloads", "index.d.ts"),
      join(fixtureDirectory, "index.d.ts")
    );
    await writeFile(
      join(fixtureDirectory, "consumer.ts"),
      `import {
  downloadPdf,
  htmlToPdf,
  pagedDomToPdf,
  type PagedDomToPdfOptions,
  type PdfResult
} from "./index.js";

declare const root: ParentNode;
const options: PagedDomToPdfOptions = {};
const result: Promise<PdfResult> = pagedDomToPdf(root, options);
void result;
void htmlToPdf;
void downloadPdf;
`,
      "utf8"
    );
    await writeFile(
      join(fixtureDirectory, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          lib: ["ES2022", "DOM"],
          module: "NodeNext",
          moduleResolution: "NodeNext",
          noEmit: true,
          skipLibCheck: false,
          strict: true,
          target: "ES2022"
        },
        files: ["consumer.ts"]
      }),
      "utf8"
    );

    await execFileAsync(process.execPath, [
      resolve("node_modules", "typescript", "bin", "tsc"),
      "--project",
      join(fixtureDirectory, "tsconfig.json")
    ]);
  } finally {
    await rm(fixtureDirectory, { force: true, recursive: true });
  }
});

test("documents the exported Paged.js DOM options type", async ({ page }) => {
  await page.goto("/manual.html");
  const code = (await page.locator("pre").allTextContents()).join("\n");

  expect(code).toContain("options?: PagedDomToPdfOptions");
  expect(code).not.toContain("PdfWriteOptions");
});
