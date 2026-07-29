import { expect, test } from "@playwright/test";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const validatorPath = resolve(
  import.meta.dirname,
  "../helpers/validate-pdf.mjs"
);

interface PdfValidation {
  readonly pageCount: number;
  readonly width: number;
  readonly height: number;
}

test("creates and downloads a valid two-page PDF", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "HTML to paged PDF" })
  ).toBeVisible();

  await page.getByRole("button", { name: "Generate PDF" }).click();
  await expect(page.getByTestId("status")).toContainText("2 pages");
  await expect(page.getByTitle("Generated PDF preview")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("paged-pdf-demo.pdf");

  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const bytes = new Uint8Array(await readFile(downloadPath!));
  expect(new TextDecoder("latin1").decode(bytes.slice(0, 5))).toBe("%PDF-");

  const { stdout } = await execFileAsync(process.execPath, [
    validatorPath,
    downloadPath!
  ]);
  const validation = JSON.parse(stdout) as PdfValidation;
  expect(validation.pageCount).toBe(2);
  expect(validation.width).toBeCloseTo(595.28, 0);
  expect(validation.height).toBeCloseTo(841.89, 0);
  expect(consoleErrors).toEqual([]);
});

test("regenerates without leaving stale render hosts", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Generate PDF" }).click();
  await expect(page.getByTestId("status")).toContainText("2 pages");

  await page
    .getByRole("textbox", { name: "HTML", exact: true })
    .fill(`
      <article>
        <h1>Single page</h1>
        <p>Regenerated content.</p>
      </article>
    `);
  await page.getByRole("button", { name: "Generate PDF" }).click();

  await expect(page.getByTestId("status")).toContainText("1 page");
  await expect(page.locator("[data-paged-pdf-render-host]")).toHaveCount(0);
});
