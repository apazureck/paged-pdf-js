import { describe, expect, it } from "vitest";

import { parseCssColor } from "../../src/css-color.js";

describe("CSS color parsing", () => {
  it("parses browser RGB values and ignores transparent colors", () => {
    expect(parseCssColor("rgb(12, 34, 56)")).toEqual([12, 34, 56]);
    expect(parseCssColor("rgba(12, 34, 56, 0)")).toBeUndefined();
    expect(parseCssColor("transparent")).toBeUndefined();
  });
});
