import { describe, expect, it } from "vitest";

import {
  applyPlaygroundSettings,
  defaultPlaygroundSettings,
  readPlaygroundSettings,
  writePlaygroundSettings
} from "../../demo/gallery-playground.js";
import type { GalleryExample } from "../../demo/gallery-types.js";

const example: GalleryExample = {
  id: "named-pages",
  group: "Page construction",
  title: "Named pages",
  shortTitle: "Named pages",
  summary: "Fixture",
  support: "match",
  features: ["named pages"],
  compareNotes: ["Compare"],
  html: "<h1>Report</h1><p>Text</p>",
  css: "@page report { size: A4 landscape; margin: 10mm; }"
};

describe("gallery playground settings", () => {
  it("adds deterministic print overrides without mutating the example", () => {
    const settings = {
      ...defaultPlaygroundSettings,
      marginMm: 28,
      fontSizePt: 13,
      lineHeight: 1.75,
      paragraphGapMm: 6,
      headingSizePt: 34
    };

    const effective = applyPlaygroundSettings(example, settings);

    expect(effective).not.toBe(example);
    expect(example.css).not.toContain("Live playground overrides");
    expect(effective.css).toContain("Live playground overrides");
    expect(effective.css).toContain("margin: 28mm !important");
    expect(effective.css).toContain("font-size: 13pt !important");
    expect(effective.css).toContain("line-height: 1.75 !important");
    expect(effective.css).toContain("margin-bottom: 6mm !important");
    expect(effective.css).toContain("font-size: 34pt !important");
    expect(effective.css).toContain("@page report");
  });

  it("round-trips settings through bounded URL parameters", () => {
    const search = writePlaygroundSettings({
      marginMm: 24,
      fontSizePt: 12.5,
      lineHeight: 1.65,
      paragraphGapMm: 3.5,
      headingSizePt: 31
    });

    expect(readPlaygroundSettings(search)).toEqual({
      marginMm: 24,
      fontSizePt: 12.5,
      lineHeight: 1.65,
      paragraphGapMm: 3.5,
      headingSizePt: 31
    });
    expect(readPlaygroundSettings("?margin=999&text=nope")).toEqual({
      ...defaultPlaygroundSettings,
      marginMm: 40
    });
  });
});
