import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

interface PackageMetadata {
  readonly version: string;
}

async function packageVersion(): Promise<string> {
  const source = await readFile(resolve("package.json"), "utf8");
  return (JSON.parse(source) as PackageMetadata).version;
}

test("serves a developer manual with the public API contract", async ({
  page
}) => {
  const response = await page.goto("/manual.html");

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/Developer manual.*paged-pdf-js/u);
  await expect(
    page.getByRole("heading", { level: 1, name: "Developer manual" })
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Site navigation" })
      .getByRole("link", { name: "Manual" })
  ).toHaveAttribute("aria-current", "page");

  for (const heading of [
    "Installation",
    "Quick start",
    "Browser bundles",
    "API reference",
    "Conversion options",
    "Errors",
    "Security and limitations"
  ]) {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }

  const code = (await page.locator("pre").allTextContents()).join("\n");
  for (const publicName of [
    "npm install paged-pdf-js",
    "htmlToPdf",
    "pagedDomToPdf",
    "downloadPdf"
  ]) {
    expect(code).toContain(publicName);
  }

  const optionsTable = page.getByRole("table", {
    name: "Conversion options"
  });
  for (const option of ["styleText", "metadata", "signal", "onProgress"]) {
    await expect(optionsTable).toContainText(option);
  }

  const errorsTable = page.getByRole("table", { name: "Error codes" });
  for (const errorCode of [
    "BROWSER_REQUIRED",
    "INVALID_INPUT",
    "PAGINATION_FAILED",
    "PDF_WRITE_FAILED"
  ]) {
    await expect(errorsTable).toContainText(errorCode);
  }
});

test("pins CDN instructions and download links to the package version", async ({
  page
}) => {
  const version = await packageVersion();
  await page.goto("/manual.html");

  const code = (await page.locator("pre").allTextContents()).join("\n");
  expect(code).toContain(
    `https://unpkg.com/paged-pdf-js@${version}/dist/paged-pdf.min.js`
  );
  expect(code).toContain("window.PagedPdf");

  const downloads = [
    ["Standalone browser bundle", "paged-pdf.min.js"],
    ["ES module bundle", "paged-pdf.js"],
    ["CommonJS bundle", "paged-pdf.cjs"],
    ["TypeScript declarations", "index.d.ts"],
    ["npm package archive", `paged-pdf-js-${version}.tgz`]
  ] as const;

  for (const [name, file] of downloads) {
    const link = page.getByRole("link", { name });
    await expect(link).toHaveAttribute("href", `/downloads/${file}`);
    await expect(link).toHaveAttribute("download", file);
  }
});

test("serves executable release downloads rather than fallback HTML", async ({
  page,
  request
}) => {
  const version = await packageVersion();
  const files = [
    "paged-pdf.min.js",
    "paged-pdf.js",
    "paged-pdf.cjs",
    "index.d.ts",
    `paged-pdf-js-${version}.tgz`
  ];

  for (const file of files) {
    const response = await request.get(`/downloads/${file}`);
    expect(response.status(), file).toBe(200);
    const bytes = await response.body();
    expect(bytes.byteLength, file).toBeGreaterThan(100);
    expect(bytes.subarray(0, 15).toString("utf8").toLowerCase()).not.toContain(
      "<!doctype html"
    );
  }

  await page.goto("/manual.html");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Standalone browser bundle" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("paged-pdf.min.js");
  const path = await download.path();
  expect(path).not.toBeNull();

  await page.goto("about:blank");
  await page.addScriptTag({ path: path! });
  const api = await page.evaluate(() =>
    Object.keys(
      (
        window as Window & {
          readonly PagedPdf?: Record<string, unknown>;
        }
      ).PagedPdf ?? {}
    )
  );
  expect(api).toEqual(
    expect.arrayContaining(["downloadPdf", "htmlToPdf", "pagedDomToPdf"])
  );
});

test("links every public page and publishes canonical URLs", async ({
  page
}) => {
  const pages = [
    ["/", "/"],
    ["/gallery.html", "/gallery.html"],
    ["/manual.html", "/manual.html"]
  ] as const;

  for (const [path, canonicalPath] of pages) {
    await page.goto(path);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `https://paged-pdf-js.pazureck.de${canonicalPath}`
    );
    await expect(
      page
        .getByRole("navigation", { name: "Site navigation" })
        .getByRole("link", { name: "Manual" })
    ).toHaveAttribute("href", "/manual.html");
  }
});

test("keeps the manual readable on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/manual.html");

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(390);
  await expect(
    page.getByRole("navigation", { name: "Manual sections" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Developer manual" })
  ).toBeVisible();
});
