import { expect, test } from "@playwright/test";
import {
  getDocument,
  OPS
} from "pdfjs-dist/legacy/build/pdf.mjs";
import { resolve } from "node:path";

const SINGLE_PIXEL_PNG_BYTES = Uint8Array.from([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0,
  1, 0, 0, 0, 1, 8, 4, 0, 0, 0, 181, 28, 12, 2, 0, 0, 0, 11, 73, 68,
  65, 84, 120, 218, 99, 100, 248, 15, 0, 1, 5, 1, 1, 39, 24, 227, 102,
  0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130
]);
const SINGLE_PIXEL_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

async function expectImageOperator(byteValues: readonly number[]): Promise<void> {
  const loadingTask = getDocument({ data: new Uint8Array(byteValues) });
  const pdf = await loadingTask.promise;
  const pdfPage = await pdf.getPage(1);
  const operators = await pdfPage.getOperatorList();
  const hasImage = operators.fnArray.some(
    (operator) =>
      operator === OPS.paintImageXObject ||
      operator === OPS.paintInlineImageXObject
  );

  expect(hasImage).toBe(true);
  await loadingTask.destroy();
}

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
  await page.addScriptTag({ path: resolve("dist/paged-pdf.min.js") });
});

test("embeds original PNG bytes without canvas capture", async ({ page }) => {
  const byteValues = await page.evaluate(async (source) => {
    const fail = () => {
      throw new Error("CANVAS_AUTHORING_IS_FORBIDDEN");
    };
    HTMLCanvasElement.prototype.getContext = fail;
    HTMLCanvasElement.prototype.toDataURL = fail;
    HTMLCanvasElement.prototype.toBlob = fail;
    const api = (
      window as unknown as {
        PagedPdf: {
          htmlToPdf: (
            html: string,
            options: { styleText: string }
          ) => Promise<{ bytes: Uint8Array }>;
        };
      }
    ).PagedPdf;
    const result = await api.htmlToPdf(
      `<img src="${source}" alt="Pixel" width="32" height="32">`,
      { styleText: "@page { size: 100px 100px; margin: 10px; }" }
    );
    return Array.from(result.bytes);
  }, SINGLE_PIXEL_PNG);

  await expectImageOperator(byteValues);
});

test("embeds an extensionless HTTP PNG by inspecting its bytes", async ({
  page
}) => {
  const imageUrl = "https://images.example.test/photo?id=1";
  await page.route(imageUrl, async (route) => {
    await route.fulfill({
      body: Buffer.from(SINGLE_PIXEL_PNG_BYTES),
      contentType: "image/png",
      headers: { "access-control-allow-origin": "*" }
    });
  });

  const byteValues = await page.evaluate(async (source) => {
    const api = (
      window as unknown as {
        PagedPdf: {
          htmlToPdf: (
            html: string,
            options: {
              allowedResourceOrigins: readonly string[];
              styleText: string;
            }
          ) => Promise<{ bytes: Uint8Array }>;
        };
      }
    ).PagedPdf;
    const result = await api.htmlToPdf(
      `<img src="${source}" alt="Pixel" width="32" height="32">`,
      {
        allowedResourceOrigins: ["https://images.example.test"],
        styleText: "@page { size: 100px 100px; margin: 10px; }"
      }
    );
    return Array.from(result.bytes);
  }, imageUrl);

  await expectImageOperator(byteValues);
});
