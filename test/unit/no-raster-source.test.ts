import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const AUTHORING_FILES = [
  "src/convert.ts",
  "src/dom-renderer.ts",
  "src/pdf-writer.ts"
];

describe("PDF authoring source boundary", () => {
  it("contains no screenshot, canvas serialization, or jsPDF html path", () => {
    const source = AUTHORING_FILES.map((file) =>
      readFileSync(resolve(file), "utf8")
    ).join("\n");

    expect(source).not.toMatch(/html2canvas/iu);
    expect(source).not.toMatch(/toDataURL/iu);
    expect(source).not.toMatch(/writeRasterPdf/iu);
    expect(source).not.toMatch(/\.html\s*\(/u);
  });
});
