import { expect, test } from "@playwright/test";

test("keeps only the latest proof during rapid example changes", async ({
  page
}) => {
  await page.goto("/gallery.html");
  await page.evaluate(async () => {
    for (const id of [
      "tables",
      "running-content",
      "fragmentation",
      "named-pages"
    ]) {
      window.location.hash = `/examples/${id}`;
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
  });

  await expect(
    page.getByRole("heading", { name: "Named pages & orientation" })
  ).toBeVisible();
  await expect(page.getByTestId("status")).toContainText(/[1-9]\d* pages?/u);
  await expect(page.locator("#error")).toBeHidden();
  await expect(
    page.frameLocator("#paged-preview").locator(".pagedjs_pages")
  ).toHaveCount(1);
  await expect(
    page.getByTestId("example-link").filter({ hasText: "Named pages" })
  ).toHaveAttribute("aria-current", "page");
});

test("supports keyboard navigation across source tabs", async ({ page }) => {
  await page.goto("/gallery.html");
  const renderedTab = page.getByRole("tab", { name: "Rendered" });
  const htmlTab = page.getByRole("tab", { name: "HTML" });
  const cssTab = page.getByRole("tab", { name: "CSS" });

  await renderedTab.focus();
  await renderedTab.press("End");
  await expect(cssTab).toBeFocused();
  await expect(cssTab).toHaveAttribute("aria-selected", "true");
  await expect(cssTab).toHaveAttribute("tabindex", "0");
  await expect(page.locator("#css-panel")).toBeVisible();
  await expect(renderedTab).toHaveAttribute("tabindex", "-1");

  await cssTab.press("ArrowLeft");
  await expect(htmlTab).toBeFocused();
  await expect(htmlTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#html-panel")).toBeVisible();
});
