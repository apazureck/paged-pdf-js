import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

test("shows source, Paged.js HTML, and PDF proof stages", async ({ page }) => {
  await page.goto("/gallery.html");

  await expect(
    page.getByRole("heading", { name: "paged-pdf.js feature lab" })
  ).toBeVisible();
  await expect(page).toHaveTitle("paged-pdf.js feature lab");
  await expect(
    page.getByRole("navigation", { name: "Paged.js examples" })
  ).toBeVisible();
  await expect(page.getByTestId("example-link")).toHaveCount(10);
  await expect(
    page.getByRole("heading", { name: "Source document" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Paged.js HTML preview" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Rendered PDF" })
  ).toBeVisible();
  await expect(page.getByTitle("Continuous source preview")).toBeVisible();
  await expect(page.getByTitle("Paged.js HTML preview")).toBeVisible();

  await expect(page.getByTestId("paged-preview-status")).toContainText(
    /[1-9]\d* pages?/u
  );
  await expect(page.getByTestId("status")).toContainText(/[1-9]\d* pages?/u);
  await expect(page.getByTitle("Generated PDF preview")).toBeVisible();
});

test("deep links and synchronizes the selected example", async ({ page }) => {
  await page.goto("/gallery.html#/examples/named-pages");

  await expect(
    page.getByRole("heading", { name: "Named pages & orientation" })
  ).toBeVisible();
  await expect(
    page.getByTestId("example-link").filter({ hasText: "Named pages" })
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("html-source")).toContainText(
    "landscape-report"
  );
  await expect(page.getByTestId("paged-preview-status")).toContainText(
    /[1-9]\d* pages?/u
  );
  await expect(page.getByTestId("status")).toContainText(/[1-9]\d* pages?/u);

  await page
    .getByTestId("example-link")
    .filter({ hasText: "Footnotes" })
    .click();
  await expect(page).toHaveURL(/gallery\.html#\/examples\/footnotes$/u);
  await expect(
    page.getByRole("heading", { name: "Footnotes" })
  ).toBeVisible();
  await expect(page.getByTestId("html-source")).toContainText("footnote");
  await expect(page.getByTestId("status")).toContainText(/[1-9]\d* pages?/u);
});

test("changes running chapter headers and restarts page numbering", async ({
  page
}) => {
  await page.goto("/gallery.html#/examples/running-content");
  await expect(page.getByTestId("paged-preview-status")).toContainText(
    /[1-9]\d* pages?/u
  );

  const preview = page.frameLocator("#paged-preview");
  const pages = preview.locator(".pagedjs_page");
  expect(await pages.count()).toBeGreaterThanOrEqual(8);

  const renderedPages = await pages.evaluateAll((elements) =>
    elements.map((element) => {
      const generatedContent = (selector: string): string => {
        const marginContent = element.querySelector(selector);
        return marginContent === null
          ? ""
          : getComputedStyle(marginContent, "::after").content;
      };

      const headers = [
        generatedContent(
          ".pagedjs_margin-top-left .pagedjs_margin-content"
        ),
        generatedContent(
          ".pagedjs_margin-top-right .pagedjs_margin-content"
        )
      ];
      return {
        className: element.getAttribute("class") ?? "",
        physicalPageNumber: Number(element.getAttribute("data-page-number")),
        counterReset: getComputedStyle(element).counterReset,
        footer: generatedContent(
          ".pagedjs_margin-bottom-center .pagedjs_margin-content"
        ),
        header: headers.find((content) => content !== "none") ?? "none"
      };
    })
  );

  const frontMatterPages = renderedPages.filter(({ className }) =>
    className.includes("pagedjs_front-matter_page")
  );
  expect(frontMatterPages).toHaveLength(2);
  expect(frontMatterPages.map(({ footer }) => footer)).toEqual([
    "counter(page, lower-roman)",
    "counter(page, lower-roman)"
  ]);

  const chapterPages = renderedPages.filter(({ className }) =>
    className.includes("pagedjs_chapter_page")
  );
  expect(chapterPages[0]?.counterReset).toBe("page 1");
  expect(chapterPages[0]?.physicalPageNumber).toBeGreaterThan(
    frontMatterPages.length
  );
  expect(new Set(chapterPages.map(({ footer }) => footer))).toEqual(
    new Set(["counter(page)"])
  );

  const chapterTitles = [
    "Chapter I: Down the Rabbit-Hole",
    "Chapter II: The Pool of Tears",
    "Chapter III: A Caucus-Race and a Long Tale"
  ];
  const headers = chapterPages.map(({ header }) => header);
  const headerTransitions = headers.filter(
    (header, index) => index === 0 || header !== headers[index - 1]
  );
  expect(headerTransitions).toEqual(
    chapterTitles.map((title) => `"${title}"`)
  );

  for (const title of chapterTitles) {
    expect(
      chapterPages.filter(({ header }) => header.includes(title)).length
    ).toBeGreaterThanOrEqual(
      2
    );
  }

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  const bytes = new Uint8Array(await readFile(downloadPath!));
  const pdf = await getDocument({ data: bytes }).promise;
  const firstChapter = await pdf.getPage(3);
  const textContent = await firstChapter.getTextContent();
  const pdfText = textContent.items
    .map((item) => ("str" in item ? item.str : ""))
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim();

  expect(pdfText).toContain("Chapter I: Down the Rabbit-Hole");
  expect(pdfText).not.toMatch(/Chapter\s+Chapter/u);
});

test("stacks the proof stages without horizontal overflow on mobile", async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/gallery.html");
  await expect(page.getByTitle("Generated PDF preview")).toBeVisible();

  const geometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    stages: Array.from(document.querySelectorAll<HTMLElement>(".proof-card")).map(
      (element) => {
        const bounds = element.getBoundingClientRect();
        return { left: bounds.left, right: bounds.right, width: bounds.width };
      }
    )
  }));

  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.stages).toHaveLength(3);
  for (const stage of geometry.stages) {
    expect(stage.left).toBeGreaterThanOrEqual(0);
    expect(stage.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(stage.width).toBeGreaterThan(280);
  }
});
