import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("vector dependency boundary", () => {
  it("uses jsPDF without screenshot or raster PDF authoring dependencies", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve("package.json"), "utf8")
    ) as {
      dependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies?.jspdf).toBeDefined();
    expect(packageJson.dependencies?.html2canvas).toBeUndefined();
    expect(packageJson.dependencies?.["pdf-lib"]).toBeUndefined();
  });
});
