import { describe, expect, it } from "vitest";

import {
  downloadPdf,
  htmlToPdf,
  pagedDomToPdf
} from "../../src/index.js";

describe("public API", () => {
  it("exports the browser conversion entry points", () => {
    expect(htmlToPdf).toBeTypeOf("function");
    expect(pagedDomToPdf).toBeTypeOf("function");
    expect(downloadPdf).toBeTypeOf("function");
  });
});
