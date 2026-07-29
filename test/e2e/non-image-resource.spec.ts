import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

test("does not load non-image media or legacy background resources", async ({
  page
}) => {
  let authoredRequests = 0;
  let redirectedRequests = 0;
  await page.route("https://media.example.test/**", async (route) => {
    authoredRequests += 1;
    await route.fulfill({
      status: 302,
      headers: { location: "https://blocked.example.test/resource" }
    });
  });
  await page.route("https://blocked.example.test/**", async (route) => {
    redirectedRequests += 1;
    await route.abort();
  });
  await page.goto("about:blank");
  await page.addScriptTag({ path: resolve("dist/paged-pdf.min.js") });

  const pageCount = await page.evaluate(async () => {
    const api = (
      window as unknown as {
        PagedPdf: {
          htmlToPdf: (
            html: string,
            options: {
              allowedResourceOrigins: readonly string[];
              styleText: string;
            }
          ) => Promise<{ pageCount: number }>;
        };
      }
    ).PagedPdf;
    const result = await api.htmlToPdf(
      `
        <video poster="https://media.example.test/poster"></video>
        <audio src="https://media.example.test/audio"></audio>
        <source src="https://media.example.test/source">
        <input type="image" src="https://media.example.test/button">
        <table background="https://media.example.test/table">
          <tr><td background="https://media.example.test/cell">Safe</td></tr>
        </table>
        <p>Safe document</p>
      `,
      {
        allowedResourceOrigins: ["https://media.example.test"],
        styleText: "@page { size: 100px 100px; margin: 10px; }"
      }
    );
    return result.pageCount;
  });

  expect(pageCount).toBeGreaterThan(0);
  expect(authoredRequests).toBe(0);
  expect(redirectedRequests).toBe(0);
});
