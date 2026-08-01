import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

test("committed browser bundle exposes the standalone API", async ({ page }) => {
  await page.goto("about:blank");
  await page.addScriptTag({
    path: resolve("browser", "paged-pdf.min.js")
  });

  const publicApi = await page.evaluate(() => {
    const pagedPdf = (
      window as Window & {
        PagedPdf?: Record<string, unknown>;
      }
    ).PagedPdf;

    return {
      htmlToPdf: typeof pagedPdf?.htmlToPdf,
      pagedDomToPdf: typeof pagedPdf?.pagedDomToPdf,
      downloadPdf: typeof pagedPdf?.downloadPdf
    };
  });

  expect(publicApi).toEqual({
    htmlToPdf: "function",
    pagedDomToPdf: "function",
    downloadPdf: "function"
  });
});
