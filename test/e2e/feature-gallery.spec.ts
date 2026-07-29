import { expect, test } from "@playwright/test";

test("shows source, Paged.js HTML, and PDF proof stages", async ({ page }) => {
  await page.goto("/gallery.html");

  await expect(
    page.getByRole("heading", { name: "Paged.js feature lab" })
  ).toBeVisible();
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
