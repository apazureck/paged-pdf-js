import { describe, expect, it } from "vitest";

import {
  cssPixelsToPoints,
  pageRectangleToPdf
} from "../../src/geometry.js";

describe("PDF geometry", () => {
  it("converts CSS pixels to PDF points at the CSS reference pixel ratio", () => {
    expect(cssPixelsToPoints(96)).toBe(72);
    expect(cssPixelsToPoints(816)).toBe(612);
    expect(cssPixelsToPoints(1056)).toBe(792);
  });

  it("maps a top-left browser rectangle to bottom-left PDF coordinates", () => {
    expect(
      pageRectangleToPdf(
        { left: 96, top: 192, width: 192, height: 96 },
        { width: 816, height: 1056 }
      )
    ).toEqual({
      x: 72,
      y: 576,
      width: 144,
      height: 72
    });
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects an invalid CSS pixel value: %s",
    (value) => {
      expect(() => cssPixelsToPoints(value)).toThrow(/positive finite/i);
    }
  );
});
