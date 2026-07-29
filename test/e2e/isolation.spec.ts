import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

test("host page styles do not leak into paginated output", async ({ page }) => {
  await page.goto("/");
  await page.addStyleTag({
    content: "article, article * { display: none !important; }"
  });

  await page.getByRole("button", { name: "Generate PDF" }).click();

  await expect(page.getByTestId("status")).toContainText("2 pages");
  await expect(page.getByTitle("Generated PDF preview")).toBeVisible();
});

test("standalone UMD build executes a full conversion", async ({ page }) => {
  await page.goto("about:blank");
  await page.addScriptTag({
    path: resolve("dist/paged-pdf.min.js")
  });

  const result = await page.evaluate(async () => {
    const pagedPdf = (
      window as unknown as {
        PagedPdf: {
          htmlToPdf: (
            html: string,
            options: {
              styleText: string;
              onProgress: (progress: { phase: string }) => void;
            }
          ) => Promise<{ pageCount: number; bytes: Uint8Array }>;
        };
      }
    ).PagedPdf;
    let sheetSize:
      | {
          width: string;
          height: string;
          rootWidth: string;
          rootHeight: string;
          styleStart: string;
        }
      | undefined;
    const pdf = await pagedPdf.htmlToPdf("<h1>Hello</h1>", {
      styleText: "@page { size: A4; margin: 20mm; }",
      onProgress: ({ phase }) => {
        if (phase !== "render") {
          return;
        }
        const container = document.querySelector<HTMLElement>(
          "[data-paged-pdf-render-host]"
        );
        const sheet =
          container?.shadowRoot?.querySelector<HTMLElement>(".pagedjs_sheet");
        const style =
          container?.shadowRoot?.querySelector<HTMLStyleElement>("style");
        if (container !== null && sheet !== null && sheet !== undefined) {
          const sheetStyle = getComputedStyle(sheet);
          const containerStyle = getComputedStyle(container);
          sheetSize = {
            width: sheetStyle.width,
            height: sheetStyle.height,
            rootWidth: containerStyle.getPropertyValue("--pagedjs-width"),
            rootHeight: containerStyle.getPropertyValue("--pagedjs-height"),
            styleStart: style?.textContent?.slice(0, 500) ?? ""
          };
        }
      }
    });
    return {
      pageCount: pdf.pageCount,
      signature: new TextDecoder("latin1").decode(pdf.bytes.slice(0, 5)),
      sheetSize
    };
  });

  expect(result.pageCount).toBe(1);
  expect(result.signature).toBe("%PDF-");
  expect(result.sheetSize?.width).toBe("793.688px");
  expect(result.sheetSize?.height).toBe("1122.52px");
});
