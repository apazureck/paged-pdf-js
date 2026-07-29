import { describe, expect, it } from "vitest";

import { cssPixelsToPoints } from "../../src/geometry.js";

describe("PDF geometry", () => {
  it("converts CSS pixels to PDF points at the CSS reference pixel ratio", () => {
    expect(cssPixelsToPoints(0)).toBe(0);
    expect(cssPixelsToPoints(96)).toBe(72);
    expect(cssPixelsToPoints(816)).toBe(612);
    expect(cssPixelsToPoints(1056)).toBe(792);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects an invalid CSS pixel value: %s",
    (value) => {
      expect(() => cssPixelsToPoints(value)).toThrow(/non-negative finite/i);
    }
  );
});
