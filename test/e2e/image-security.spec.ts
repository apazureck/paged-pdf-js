import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

test("rejects image redirects before contacting a non-allowlisted origin", async ({
  page
}) => {
  const redirectUrl = "https://images.example.test/redirect";
  const blockedUrl = "https://blocked.example.test/final.png";
  let blockedRequests = 0;
  await page.route(redirectUrl, async (route) => {
    await route.fulfill({
      status: 302,
      headers: { location: blockedUrl }
    });
  });
  await page.route(blockedUrl, async (route) => {
    blockedRequests += 1;
    await route.abort();
  });
  await page.goto("about:blank");
  await page.addScriptTag({ path: resolve("dist/paged-pdf.min.js") });

  const errorCode = await page.evaluate(async (source) => {
    const api = (
      window as unknown as {
        PagedPdf: {
          htmlToPdf: (
            html: string,
            options: {
              allowedResourceOrigins: readonly string[];
              styleText: string;
            }
          ) => Promise<unknown>;
        };
      }
    ).PagedPdf;
    try {
      await api.htmlToPdf(`<img src="${source}" alt="">`, {
        allowedResourceOrigins: ["https://images.example.test"],
        styleText: "@page { size: 100px 100px; margin: 10px; }"
      });
      return "NO_ERROR";
    } catch (error) {
      return (error as { code?: string }).code ?? "UNKNOWN";
    }
  }, redirectUrl);

  expect(errorCode).toBe("IMAGE_ERROR");
  expect(blockedRequests).toBe(0);
});
