import { describe, expect, it } from "vitest";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";

import { writeVectorPdf } from "../../src/pdf-writer.js";

const SINGLE_PIXEL_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("vector PDF images", () => {
  it("embeds PNG source bytes as a content image", async () => {
    const bytes = await writeVectorPdf([
      {
        widthCssPixels: 100,
        heightCssPixels: 100,
        commands: [
          {
            kind: "image",
            source: SINGLE_PIXEL_PNG,
            x: 10,
            y: 10,
            width: 32,
            height: 32
          }
        ]
      }
    ]);
    const loadingTask = getDocument({ data: bytes.slice() });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const operators = await page.getOperatorList();

    expect(
      operators.fnArray.some(
        (operator) =>
          operator === OPS.paintImageXObject ||
          operator === OPS.paintInlineImageXObject
      )
    ).toBe(true);
    await loadingTask.destroy();
  });
});
