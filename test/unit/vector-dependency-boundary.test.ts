import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("PDF dependency boundary", () => {
  it("uses jsPDF plus the explicit hybrid rasterizer", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve("package.json"), "utf8")
    ) as {
      dependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies?.jspdf).toBeDefined();
    expect(packageJson.dependencies?.html2canvas).toBeDefined();
    expect(packageJson.dependencies?.["pdf-lib"]).toBeUndefined();
  });
});
