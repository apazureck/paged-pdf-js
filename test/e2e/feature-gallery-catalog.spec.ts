import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test("renders every catalog example and downloads PDF bytes", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/gallery.html");
  const exampleIds = await page
    .getByTestId("example-link")
    .evaluateAll((links) =>
      links.map((link) => link.getAttribute("data-example-id"))
    );

  expect(exampleIds).toHaveLength(10);
  for (const id of exampleIds) {
    expect(id).not.toBeNull();
    await page.goto(`/gallery.html#/examples/${id}`);
    await expect(page.getByTestId("paged-preview-status")).toContainText(
      /[1-9]\d* pages?/u
    );
    await expect(page.getByTestId("status")).toContainText(
      /[1-9]\d* pages?/u
    );
    await expect(page.locator("#error")).toBeHidden();
    await expect(page.getByTitle("Generated PDF preview")).toHaveAttribute(
      "src",
      /^blob:/u
    );
  }

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  const bytes = await readFile(path!);
  expect(bytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  expect(consoleErrors).toEqual([]);
});
