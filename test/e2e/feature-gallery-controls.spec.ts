import { expect, test } from "@playwright/test";

test("updates source, Paged.js preview, PDF, and URL from live controls", async ({
  page
}) => {
  await page.goto("/gallery.html#/examples/page-size");
  await expect(page.getByTestId("status")).toContainText(/[1-9]\d* pages?/u);
  await expect(page.getByTestId("playground-control")).toHaveCount(5);

  const margin = page.getByTestId("control-margin");
  await margin.evaluate((input: HTMLInputElement) => {
    input.value = "28";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

  await expect(page.getByTestId("value-margin")).toHaveText("28 mm");
  await page.getByRole("tab", { name: "CSS" }).click();
  await expect(page.getByTestId("css-source")).toContainText(
    "margin: 28mm !important"
  );
  await expect(page).toHaveURL(/[?&]margin=28(?:&|#)/u);
  await expect(page.getByTestId("status")).toContainText(/[1-9]\d* pages?/u);
  await expect(page.getByTitle("Generated PDF preview")).toHaveAttribute(
    "src",
    /^blob:/u
  );

  await page.getByRole("button", { name: "Reset parameters" }).click();
  await expect(page.getByTestId("value-margin")).toHaveText("18 mm");
  await expect(page.getByTestId("value-heading")).toHaveText("18 pt");
  await expect(page.getByTestId("css-source")).toContainText(
    "margin: 18mm !important"
  );
  await expect(page.getByTestId("status")).toContainText(/[1-9]\d* pages?/u);
});

test("keeps the controls usable without horizontal overflow on mobile", async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/gallery.html");
  await expect(page.getByTestId("playground-control")).toHaveCount(5);

  const geometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    controls: Array.from(
      document.querySelectorAll<HTMLElement>("[data-testid=playground-control]")
    ).map((element) => element.getBoundingClientRect().width)
  }));

  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.controls).toHaveLength(5);
  for (const width of geometry.controls) {
    expect(width).toBeGreaterThan(140);
  }
});
