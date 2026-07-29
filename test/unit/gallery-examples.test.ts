import { describe, expect, it } from "vitest";

import {
  findGalleryExample,
  galleryExamples
} from "../../demo/gallery-examples.js";

describe("feature gallery registry", () => {
  it("contains ten uniquely addressable examples", () => {
    expect(galleryExamples).toHaveLength(10);
    expect(new Set(galleryExamples.map(({ id }) => id)).size).toBe(10);
  });

  it("provides source, CSS, features, and comparison notes for every example", () => {
    for (const example of galleryExamples) {
      expect(example.html.trim()).not.toBe("");
      expect(example.css).toContain("@page");
      expect(example.features.length).toBeGreaterThan(0);
      expect(example.compareNotes.length).toBeGreaterThan(0);
    }
  });

  it("resolves deep links and falls back to the first example", () => {
    expect(findGalleryExample("footnotes").id).toBe("footnotes");
    expect(findGalleryExample("missing").id).toBe(galleryExamples[0].id);
  });
});
