import { expect, test } from "@playwright/test";

test("restores tuned parameters and supports native range keyboard input", async ({
  page
}) => {
  await page.goto(
    "/gallery.html?margin=26&text=14&leading=1.8&gap=6&heading=36#/examples/columns"
  );
  await expect(page.getByTestId("status")).toContainText(/[1-9]\d* pages?/u);

  const margin = page.getByTestId("control-margin");
  await expect(margin).toHaveValue("26");
  await expect(page.getByTestId("control-text")).toHaveValue("14");
  await expect(page.getByTestId("control-leading")).toHaveValue("1.8");
  await expect(page.getByTestId("control-gap")).toHaveValue("6");
  await expect(page.getByTestId("control-heading")).toHaveValue("36");

  await margin.focus();
  await margin.press("ArrowRight");
  await expect(margin).toHaveValue("27");
  await expect(margin).toHaveAttribute("aria-valuetext", "27 mm");
  await expect(page.getByTestId("value-margin")).toHaveText("27 mm");
  await expect(page.getByTestId("status")).toContainText(/[1-9]\d* pages?/u);

  await page.reload();
  await expect(page.getByTestId("control-margin")).toHaveValue("27");
  await expect(page.getByTestId("status")).toContainText(/[1-9]\d* pages?/u);
  await expect(
    page.frameLocator("#paged-preview").locator(".paged-render-host")
  ).toHaveCount(1);
});
