import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";

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

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  const bytes = new Uint8Array(await readFile(downloadPath!));
  const pdf = await getDocument({ data: bytes }).promise;
  const firstPage = await pdf.getPage(1);
  const textContent = await firstPage.getTextContent();
  const pdfText = textContent.items
    .map((item) => ("str" in item ? item.str : ""))
    .join(" ");

  expect(pdfText).toContain("PAGED MEDIA FIELD NOTES");
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

  const preview = page.frameLocator("#paged-preview");
  const reportPreviewGeometry = await preview
    .locator(".pagedjs_report_page")
    .evaluate((element) => {
      const pageBounds = element.getBoundingClientRect();
      const sheetBounds = element
        .querySelector<HTMLElement>(".pagedjs_sheet")!
        .getBoundingClientRect();
      const pageboxBounds = element
        .querySelector<HTMLElement>(".pagedjs_pagebox")!
        .getBoundingClientRect();
      const contentBounds = element
        .querySelector<HTMLElement>(".pagedjs_page_content")!
        .getBoundingClientRect();
      return {
        pageWidth: pageBounds.width,
        pageHeight: pageBounds.height,
        sheetWidth: sheetBounds.width,
        sheetRight: sheetBounds.right,
        pageboxWidth: pageboxBounds.width,
        contentRight: contentBounds.right
      };
    });

  expect(reportPreviewGeometry.pageWidth).toBeGreaterThan(
    reportPreviewGeometry.pageHeight
  );
  expect(reportPreviewGeometry.sheetWidth).toBeCloseTo(
    reportPreviewGeometry.pageboxWidth,
    1
  );
  expect(reportPreviewGeometry.contentRight).toBeLessThanOrEqual(
    reportPreviewGeometry.sheetRight + 1
  );

  const namedDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const namedDownload = await namedDownloadPromise;
  const namedDownloadPath = await namedDownload.path();
  const namedPdf = await getDocument({
    data: new Uint8Array(await readFile(namedDownloadPath!))
  }).promise;
  const coverPage = await namedPdf.getPage(1);
  const reportPage = await namedPdf.getPage(2);
  const reportTextContent = await reportPage.getTextContent();
  const reportPdfText = reportTextContent.items
    .map((item) => ("str" in item ? item.str : ""))
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim();
  const reportRightEdge = Math.max(
    ...reportTextContent.items.map((item) =>
      "transform" in item && "width" in item
        ? item.transform[4] + item.width
        : 0
    )
  );

  expect(coverPage.view[2]).toBeCloseTo(419.5, 0);
  expect(coverPage.view[3]).toBeCloseTo(595.3, 0);
  expect(reportPage.view[2]).toBeCloseTo(841.9, 0);
  expect(reportPage.view[3]).toBeCloseTo(595.3, 0);
  expect(reportRightEdge).toBeLessThanOrEqual(reportPage.view[2]!);
  expect(reportPdfText).toContain(
    "Paged.js establishes each fragment before the PDF writer translates " +
      "the geometry into selectable text and vector shapes."
  );

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

test("keeps the chapters source document within its desktop pane", async ({
  page
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/gallery.html#/examples/running-content");

  const source = page.frameLocator("#source-preview");
  await expect(source.locator(".book-cover")).toBeVisible();
  const geometry = await source.locator("html").evaluate((element) => {
    const body = element.querySelector("body")!;
    const image = element.querySelector<HTMLImageElement>(".book-cover")!;
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      bodyWidth: body.getBoundingClientRect().width,
      imageWidth: image.getBoundingClientRect().width,
      imageRatio:
        image.getBoundingClientRect().width /
        image.getBoundingClientRect().height,
      naturalRatio: image.naturalWidth / image.naturalHeight
    };
  });

  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
  expect(geometry.imageWidth).toBeLessThanOrEqual(geometry.bodyWidth);
  expect(geometry.imageRatio).toBeCloseTo(geometry.naturalRatio, 2);
});

test("preserves styled footnote calls and markers in the preview and PDF", async ({
  page
}) => {
  await page.goto("/gallery.html#/examples/footnotes");
  await expect(page.getByTestId("paged-preview-status")).toContainText(
    /[1-9]\d* pages?/u
  );

  const preview = page.frameLocator("#paged-preview");
  const calls = preview.locator(".paged-pdf-footnote-call-label");
  const markers = preview.locator(".paged-pdf-footnote-note-label");
  await expect(preview.locator(".pagedjs_page")).toHaveCount(3);
  await expect(calls).toHaveCount(6);
  await expect(markers).toHaveCount(6);
  expect(await calls.allTextContents()).toEqual([
    "1", "2", "(3)", "(4)", "[5]", "[6]"
  ]);
  expect(
    await markers.evaluateAll((elements) =>
      elements.map((element) => element.textContent?.trim())
    )
  ).toEqual(["1", "2", "(3)", "(4)", "[5]", "[6]"]);
  expect(
    await preview
      .locator("[data-footnote-call]")
      .evaluateAll((elements) =>
        elements.map((element) => getComputedStyle(element, "::after").content)
      )
  ).toEqual(["none", "none", "none", "none", "none", "none"]);
  await expect(preview.locator(".pagedjs_footnote_area").first()).toContainText(
    "A decimal footnote is concise and familiar."
  );
  await expect(preview.locator(".pagedjs_footnote_area").nth(2)).toContainText(
    "Square brackets provide a compact alternative style."
  );

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  const pdf = await getDocument({
    data: new Uint8Array(await readFile(downloadPath!))
  }).promise;
  const pdfText = (
    await Promise.all(
      Array.from({ length: pdf.numPages }, async (_value, index) => {
        const pdfPage = await pdf.getPage(index + 1);
        const content = await pdfPage.getTextContent();
        return content.items
          .map((item) => "str" in item ? item.str : "")
          .join(" ");
      })
    )
  ).join(" ");
  expect(pdf.numPages).toBe(3);
  const compactPdfText = pdfText.replace(/\s+/gu, "");

  expect(
    (compactPdfText.match(/\(3\)/gu) ?? []).length
  ).toBeGreaterThanOrEqual(2);
  expect(
    (compactPdfText.match(/\(4\)/gu) ?? []).length
  ).toBeGreaterThanOrEqual(2);
  expect(
    (compactPdfText.match(/\[5\]/gu) ?? []).length
  ).toBeGreaterThanOrEqual(2);
  expect(
    (compactPdfText.match(/content:attr\(data-footnote-label\)/gu) ?? []).length
  ).toBeGreaterThanOrEqual(6);
  expect(pdfText).toContain("A decimal footnote is concise and familiar.");
  expect(pdfText).toContain(
    "Square brackets provide a compact alternative style."
  );
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
  expect(await pages.count()).toBeGreaterThanOrEqual(9);
  const sourceCover = page
    .frameLocator("#source-preview")
    .locator(".book-cover");
  const pagedCover = preview.locator(".book-cover");
  await expect(sourceCover).toBeVisible();
  await expect(pagedCover).toBeVisible();
  const coverGeometry = await pagedCover.evaluate((image: HTMLImageElement) => ({
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      bounds: (() => {
        const imageBounds = image.getBoundingClientRect();
        const sheet = image
          .closest(".pagedjs_page")
          ?.querySelector<HTMLElement>(".pagedjs_sheet");
        const sheetBounds = sheet?.getBoundingClientRect();
        return sheetBounds === undefined
          ? undefined
          : {
              bottom: Math.abs(imageBounds.bottom - sheetBounds.bottom),
              left: Math.abs(imageBounds.left - sheetBounds.left),
              right: Math.abs(imageBounds.right - sheetBounds.right),
              top: Math.abs(imageBounds.top - sheetBounds.top)
            };
      })()
    }));
  expect(coverGeometry).toMatchObject({
    complete: true,
    naturalWidth: 960
  });
  expect(coverGeometry.bounds).toBeDefined();
  for (const inset of Object.values(coverGeometry.bounds ?? {})) {
    expect(inset).toBeLessThan(0.1);
  }

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
        header: headers.find((content) => content !== "none") ?? "none",
        hasCover: element.querySelector(".cover-page") !== null,
        hasTitlePage: element.querySelector(".title-page") !== null,
        hasContentsPage: element.querySelector(".contents-page") !== null
      };
    })
  );

  expect(renderedPages.slice(0, 3)).toMatchObject([
    { hasCover: true, hasTitlePage: false, hasContentsPage: false },
    { hasCover: false, hasTitlePage: true, hasContentsPage: false },
    { hasCover: false, hasTitlePage: false, hasContentsPage: true }
  ]);
  const coverPages = renderedPages.filter(({ className }) =>
    className.includes("pagedjs_cover_page")
  );
  expect(coverPages).toHaveLength(1);

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
  const coverPdfPage = await pdf.getPage(1);
  const coverPageOperators = await coverPdfPage.getOperatorList();
  expect(
    coverPageOperators.fnArray.some(
      (operator) =>
        operator === OPS.paintImageXObject ||
        operator === OPS.paintInlineImageXObject
    )
  ).toBe(true);
  const coverTransforms: number[][] = coverPageOperators.fnArray.flatMap(
    (operator, index) => {
      const values = coverPageOperators.argsArray[index] ?? [];
      return operator === OPS.transform &&
        values.every((value: unknown) => typeof value === "number")
        ? [values as number[]]
        : [];
    }
  );
  const coverTransform = coverTransforms.at(-1);
  const coverViewport = coverPdfPage.getViewport({ scale: 1 });
  expect(coverTransform).toBeDefined();
  expect(coverTransform?.[0]).toBeCloseTo(coverViewport.width, 1);
  expect(coverTransform?.[1]).toBe(0);
  expect(coverTransform?.[2]).toBe(0);
  expect(coverTransform?.[3]).toBeCloseTo(coverViewport.height, 1);
  expect(coverTransform?.[4]).toBe(0);
  expect(coverTransform?.[5]).toBe(0);
  const pageText = async (pageNumber: number): Promise<string> => {
    const pdfPage = await pdf.getPage(pageNumber);
    const content = await pdfPage.getTextContent();
    return content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/gu, " ")
      .trim();
  };
  expect(await pageText(1)).toBe("");
  const titlePageText = await pageText(2);
  expect(titlePageText.replace(/\s+/gu, "").toLowerCase()).toContain(
    "long-formtypesettingspecimen"
  );
  expect(titlePageText).toContain("Public-domain");
  expect(await pageText(3)).toContain("Three chapters");

  const firstChapter = await pdf.getPage(4);
  const textContent = await firstChapter.getTextContent();
  const pdfText = textContent.items
    .map((item) => ("str" in item ? item.str : ""))
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim();

  expect(pdfText).toContain("Chapter I: Down the Rabbit-Hole");
  expect(pdfText).not.toMatch(/Chapter\s+Chapter/u);
});

test("shows protected and forced fragmentation boundaries", async ({ page }) => {
  await page.goto("/gallery.html#/examples/fragmentation");
  await expect(page.getByTestId("paged-preview-status")).toContainText(
    /[1-9]\d* pages?/u
  );

  const geometry = await page
    .frameLocator("#paged-preview")
    .locator(".pagedjs_pages")
    .evaluate((pages) => {
      const pageNumber = (selector: string): number | undefined => {
        const element = pages.querySelector(selector);
        const page = element?.closest<HTMLElement>(".pagedjs_page");
        const value = Number(page?.dataset.pageNumber);
        return Number.isFinite(value) ? value : undefined;
      };
      const protectedPages = Array.from(
        pages.querySelectorAll(".keep-together")
      ).map((element) =>
        Number(
          element.closest<HTMLElement>(".pagedjs_page")?.dataset.pageNumber
        )
      );

      return {
        openingTail: pageNumber(".opening-tail"),
        protectedPages: [...new Set(protectedPages)],
        breakBefore: pageNumber(".break-before-page"),
        breakAfter: pageNumber(".break-after-page"),
        closing: pageNumber(".closing-page")
      };
    });

  expect(geometry.protectedPages).toHaveLength(1);
  expect(geometry.protectedPages[0]).toBeGreaterThan(geometry.openingTail!);
  expect(geometry.breakBefore).toBeGreaterThan(geometry.protectedPages[0]!);
  expect(geometry.closing).toBe(geometry.breakAfter! + 1);
});

test("preserves column rules and letter spacing in the PDF", async ({
  page
}) => {
  await page.goto("/gallery.html#/examples/columns");
  await expect(page.getByTestId("status")).toContainText(/[1-9]\d* pages?/u);

  const previewRule = await page
    .frameLocator("#paged-preview")
    .locator(".columns")
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        color: style.columnRuleColor,
        style: style.columnRuleStyle,
        width: Number.parseFloat(style.columnRuleWidth)
      };
    });
  expect(previewRule).toMatchObject({
    color: "rgb(182, 198, 202)",
    style: "solid"
  });
  expect(previewRule.width).toBeGreaterThan(0);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  const pdf = await getDocument({
    data: new Uint8Array(await readFile(downloadPath!))
  }).promise;
  const firstPage = await pdf.getPage(1);
  const operators = await firstPage.getOperatorList();
  const fillColors: number[][] = operators.fnArray.flatMap((operator, index) => {
    if (operator !== OPS.setFillRGBColor) {
      return [];
    }
    const values: number[] = (operators.argsArray[index] ?? []).flatMap(
      (argument: unknown) => {
        if (typeof argument === "number") {
          return [argument];
        }
        return ArrayBuffer.isView(argument)
          ? Array.from(argument as Uint8Array)
          : [];
      }
    );
    return [
      values.map((value: number) => value <= 1 ? value * 255 : value)
    ];
  });
  const characterSpacings: number[] = operators.fnArray.flatMap(
    (operator, index) => operator === OPS.setCharSpacing
      ? (operators.argsArray[index] ?? []).filter(
          (value: unknown): value is number => typeof value === "number"
        )
      : []
  );
  const textContent = await firstPage.getTextContent();
  const normalizedText = textContent.items
    .map((item) => "str" in item ? item.str : "")
    .join("")
    .replace(/\s+/gu, "");

  expect(
    fillColors.some((color: number[]) =>
      color.slice(0, 3).every(
        (value: number, index: number) =>
          Math.abs(value - [182, 198, 202][index]!) < 2
      )
    )
  ).toBe(true);
  expect(normalizedText).toContain("FRAGMENTATION/04");
  expect(
    characterSpacings.some((spacing: number) => spacing > 0)
  ).toBe(true);

});

test("renders repeated table headings in the preview and PDF", async ({
  page
}) => {
  await page.goto(
    "/gallery.html?margin=26&text=14&leading=1.8&gap=6&heading=36#/examples/columns"
  );
  await expect(page.getByTestId("status")).toContainText(/[1-9]\d* pages?/u);
  await page.locator('[data-example-id="tables"]').click();
  await expect(page.getByTestId("status")).toContainText(/[1-9]\d* pages?/u);

  const preview = page.frameLocator("#paged-preview");
  await expect(preview.locator("table").first()).toBeVisible();
  await expect(preview.locator("tbody tr")).toHaveCount(24);
  const firstPreviewPage = preview.locator(".pagedjs_page").first();
  await expect(firstPreviewPage.locator("table")).toBeVisible();
  await expect(
    firstPreviewPage.locator("table > caption h1")
  ).toHaveText("Survey register");
  await expect(firstPreviewPage.getByText("ST-01", { exact: true })).toBeVisible();
  const firstPageGeometry = await firstPreviewPage.evaluate((pageElement) => {
    const content = pageElement.querySelector<HTMLElement>(
      ".pagedjs_page_content"
    );
    const table = pageElement.querySelector<HTMLTableElement>("table");
    const firstCell = Array.from(
      pageElement.querySelectorAll<HTMLTableCellElement>("td")
    ).find((cell) => cell.textContent?.trim() === "ST-01");
    if (content === null || table === null || firstCell === undefined) {
      throw new Error("First-page table geometry is incomplete.");
    }
    const contentBounds = content.getBoundingClientRect();
    const tableBounds = table.getBoundingClientRect();
    const cellBounds = firstCell.getBoundingClientRect();
    return {
      contentBottom: contentBounds.bottom,
      contentTop: contentBounds.top,
      firstCellBottom: cellBounds.bottom,
      tableTop: tableBounds.top
    };
  });
  expect(firstPageGeometry.tableTop).toBeGreaterThanOrEqual(firstPageGeometry.contentTop);
  expect(firstPageGeometry.firstCellBottom).toBeLessThanOrEqual(firstPageGeometry.contentBottom);
  await expect(
    preview.locator(".pagedjs_page").last().getByText("ST-24", { exact: true })
  ).toBeVisible();
  const pagesWithTableHeadings = await preview
    .locator(".pagedjs_page")
    .evaluateAll((pages) =>
      pages.filter((page) =>
        Array.from(page.querySelectorAll("th"))
          .some((heading) => heading.textContent?.trim() === "Station")
      ).length
    );
  expect(pagesWithTableHeadings).toBeGreaterThanOrEqual(2);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  const pdf = await getDocument({
    data: new Uint8Array(await readFile(downloadPath!))
  }).promise;
  const firstPdfPage = await pdf.getPage(1);
  const pageTexts = await Promise.all(
    Array.from({ length: pdf.numPages }, async (_value, index) => {
      const pdfPage = await pdf.getPage(index + 1);
      const textContent = await pdfPage.getTextContent();
      return textContent.items
        .map((item) => "str" in item ? item.str : "")
        .join(" ")
        .replace(/\s+/gu, " ")
        .trim();
    })
  );
  const pdfText = pageTexts.join(" ");
  const repeatedHeadingCount = pageTexts.filter((text) =>
    text.includes("Station")
  ).length;

  const firstPdfText = await firstPdfPage.getTextContent();
  const firstStation = firstPdfText.items.find(
    (item) => "str" in item && item.str.includes("ST-01")
  );
  expect(firstStation).toBeDefined();
  if (firstStation !== undefined && "transform" in firstStation) {
    const viewport = firstPdfPage.getViewport({ scale: 1 });
    const stationY = firstStation.transform[5]!;
    expect(stationY).toBeGreaterThanOrEqual(0);
    expect(stationY).toBeLessThanOrEqual(viewport.height);
  }

  expect(pdfText).toContain("ST-01");
  expect(pdfText).toContain("ST-24");
  expect(pageTexts[0]).toContain("ST-01");
  expect(pageTexts.at(-1)).toContain("ST-24");
  expect(repeatedHeadingCount).toBeGreaterThanOrEqual(2);
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
