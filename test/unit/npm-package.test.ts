import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("npm package contents", () => {
  it("publishes runtime artifacts without development source maps", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
      readonly files?: readonly string[];
    };

    expect(packageJson.files).toEqual([
      "dist/index.d.ts",
      "dist/paged-pdf.js",
      "dist/paged-pdf.cjs",
      "dist/paged-pdf.min.js",
      "LICENSE",
      "README.md",
      "THIRD_PARTY_NOTICES.md"
    ]);
    expect(packageJson.files).not.toContain("dist");
    expect(packageJson.files?.some((file) => file.endsWith(".map"))).toBe(false);
  });
});
