import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  getDocument,
  OPS
} from "pdfjs-dist/legacy/build/pdf.mjs";

function extractedText(items: readonly unknown[]): string {
  return items
    .map((item) =>
      typeof item === "object" && item !== null && "str" in item
        ? String(item.str)
        : ""
    )
    .join(" ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

test("creates selectable text and links without canvas authoring", async ({
  page
}) => {
  await page.addInitScript(() => {
    const fail = () => {
      throw new Error("CANVAS_AUTHORING_IS_FORBIDDEN");
    };
    HTMLCanvasElement.prototype.getContext = fail;
    HTMLCanvasElement.prototype.toDataURL = fail;
    HTMLCanvasElement.prototype.toBlob = fail;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Generate PDF" }).click();
  await expect(page.getByTestId("status")).toContainText("2 pages");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();

  const bytes = new Uint8Array(await readFile(downloadPath!));
  const loadingTask = getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  const firstPage = await pdf.getPage(1);
  const secondPage = await pdf.getPage(2);
  const firstText = await firstPage.getTextContent();
  const secondText = await secondPage.getTextContent();
  const firstOperators = await firstPage.getOperatorList();
  const annotations = await firstPage.getAnnotations();

  expect(extractedText(firstText.items)).toContain(
    "The shape of a printed page"
  );
  expect(extractedText(secondText.items)).toContain(
    "Designed for the browser"
  );
  expect(firstOperators.fnArray).not.toContain(OPS.paintImageXObject);
  expect(annotations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ url: "https://pagedjs.org/" })
    ])
  );
  await loadingTask.destroy();
});
