import { describe, expect, it, vi } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import { writeVectorPdf } from "../../src/pdf-writer.js";
import type { VectorPage } from "../../src/display-list.js";

describe("vector PDF writer", () => {
  it("writes selectable text, page geometry, backgrounds, and links", async () => {
    const pages: readonly VectorPage[] = [
      {
        widthCssPixels: 816,
        heightCssPixels: 1056,
        commands: [
          {
            kind: "fill",
            x: 24,
            y: 24,
            width: 240,
            height: 48,
            color: [240, 244, 248]
          },
          {
            kind: "text",
            text: "Selectable vector text",
            x: 32,
            y: 58,
            fontFamily: "helvetica",
            fontStyle: "bold",
            fontSize: 18,
            color: [20, 30, 40]
          },
          {
            kind: "link",
            x: 32,
            y: 32,
            width: 180,
            height: 32,
            url: "https://example.com/"
          }
        ]
      }
    ];
    const onPageWritten = vi.fn();

    const bytes = await writeVectorPdf(pages, {
      title: "Vector test",
      onPageWritten
    });
    const pdf = await getDocument({ data: bytes.slice() }).promise;
    const page = await pdf.getPage(1);
    const text = await page.getTextContent();
    const annotations = await page.getAnnotations();

    expect(page.view[2]).toBeCloseTo(612, 0);
    expect(page.view[3]).toBeCloseTo(792, 0);
    expect(text.items.map((item) => ("str" in item ? item.str : "")).join(" "))
      .toContain("Selectable vector text");
    expect(annotations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: "https://example.com/" })
      ])
    );
    expect(onPageWritten).toHaveBeenCalledWith(1);
  });
});
