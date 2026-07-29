import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

test("resource policy blocks CSS and SVG resource requests", async ({ page }) => {
  const blockedRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("tracker.invalid")) {
      blockedRequests.push(request.url());
    }
  });

  await page.goto("about:blank");
  await page.addScriptTag({ path: resolve("dist/paged-pdf.min.js") });
  const result = await page.evaluate(async () => {
    const api = (
      window as unknown as {
        PagedPdf: {
          htmlToPdf: (
            html: string,
            options: { styleText?: string }
          ) => Promise<{ pageCount: number }>;
        };
      }
    ).PagedPdf;

    async function errorCodeFor(styleText: string): Promise<string | undefined> {
      try {
        await api.htmlToPdf("<p>Blocked CSS</p>", { styleText });
        return undefined;
      } catch (error) {
        return (error as { code?: string }).code;
      }
    }

    const escapedCssErrorCode = await errorCodeFor(
      "p { background: u\\72l(https://tracker.invalid/escaped.png); }"
    );
    const imageSetErrorCode = await errorCodeFor(
      'p { background-image: image-set("https://tracker.invalid/image-set.png" 1x); }'
    );
    const escapedImportErrorCode = await errorCodeFor(
      '@im\\70ort "https://tracker.invalid/import.css"; p { color: black; }'
    );

    const svgResult = await api.htmlToPdf(
      `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">
        <image href="https://tracker.invalid/svg.png" width="20" height="20"></image>
      </svg>`,
      { styleText: "@page { size: A4; margin: 20mm; }" }
    );

    return {
      escapedCssErrorCode,
      imageSetErrorCode,
      escapedImportErrorCode,
      svgPages: svgResult.pageCount
    };
  });

  expect(result.escapedCssErrorCode).toBe("INVALID_INPUT");
  expect(result.imageSetErrorCode).toBe("INVALID_INPUT");
  expect(result.escapedImportErrorCode).toBe("INVALID_INPUT");
  expect(result.svgPages).toBe(1);
  expect(blockedRequests).toEqual([]);
});
