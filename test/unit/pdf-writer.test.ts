import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import { writeRasterPdf } from "../../src/pdf-writer.js";

const SINGLE_PIXEL_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XwWfGQAAAABJRU5ErkJggg==";

describe("PDF writer", () => {
  it("creates a parseable PDF with matching page count and dimensions", async () => {
    const bytes = await writeRasterPdf(
      [
        { dataUrl: SINGLE_PIXEL_PNG, widthCssPixels: 816, heightCssPixels: 1056 },
        { dataUrl: SINGLE_PIXEL_PNG, widthCssPixels: 1056, heightCssPixels: 816 }
      ],
      { title: "Test document" }
    );

    expect(new TextDecoder("latin1").decode(bytes.slice(0, 5))).toBe("%PDF-");

    const pdf = await getDocument({ data: bytes.slice() }).promise;
    expect(pdf.numPages).toBe(2);

    const firstPage = await pdf.getPage(1);
    const secondPage = await pdf.getPage(2);

    expect(firstPage.view[2]).toBeCloseTo(612, 0);
    expect(firstPage.view[3]).toBeCloseTo(792, 0);
    expect(secondPage.view[2]).toBeCloseTo(792, 0);
    expect(secondPage.view[3]).toBeCloseTo(612, 0);
  });
});
