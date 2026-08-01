import { expect, test } from "@playwright/test";

const logoPath = "/brand/paged-pdf-js-logo.png";

test("uses the project logo consistently across every public page", async ({
  page,
  request
}) => {
  const response = await request.get(logoPath);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
  expect((await response.body()).subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  );

  for (const path of ["/", "/gallery.html", "/manual.html"]) {
    await page.goto(path);

    const home = page.getByRole("link", { name: "paged-pdf-js home" });
    const logo = home.locator("img");
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute("src", logoPath);
    await expect(logo).toHaveAttribute("alt", "");
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
      "href",
      logoPath
    );
  }
});
