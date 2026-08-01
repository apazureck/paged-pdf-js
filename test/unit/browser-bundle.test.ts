import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const browserBundlePath = resolve("browser", "paged-pdf.min.js");
const rawBundleUrl =
  "https://raw.githubusercontent.com/apazureck/paged-pdf-js/main/browser/paged-pdf.min.js";
const executableBundleUrl =
  "https://cdn.jsdelivr.net/gh/apazureck/paged-pdf-js@main/browser/paged-pdf.min.js";

describe("direct-download browser bundle", () => {
  it("ships a bounded standalone minified artifact without a source-map dependency", async () => {
    const [bundle, bundleStats] = await Promise.all([
      readFile(browserBundlePath, "utf8"),
      stat(browserBundlePath)
    ]);

    expect(bundleStats.size).toBeGreaterThan(0);
    expect(bundleStats.size).toBeLessThan(1_500_000);
    expect(bundle).toContain("PagedPdf");
    expect(bundle).not.toContain("sourceMappingURL");
  });

  it("regenerates the committed artifact as part of the library build", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
      readonly scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["prepare:browser"]).toBe(
      "node scripts/prepare-browser-bundle.mjs"
    );
    expect(packageJson.scripts?.["build:lib"]).toContain(
      "npm run prepare:browser"
    );
  });

  it("documents both the Raw download and browser-executable GitHub CDN URL", async () => {
    const readme = await readFile("README.md", "utf8");

    expect(readme).toContain(rawBundleUrl);
    expect(readme).toContain(executableBundleUrl);
    expect(readme).toContain("GitHub Raw");
    expect(readme).toContain("text/plain");
  });
});
