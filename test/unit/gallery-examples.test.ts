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

  it("defines front matter and chapter numbering for the long-form example", () => {
    const example = findGalleryExample("running-content");

    expect(example.html).toContain('class="front-matter');
    expect(example.html.match(/class="chapter/gu)?.length).toBeGreaterThanOrEqual(
      3
    );
    expect(example.css).toMatch(/counter\(page,\s*lower-roman\)/u);
    expect(example.css).toMatch(/counter\(page,\s*decimal\)/u);
    expect(example.css).toMatch(/counter-reset:\s*page\s+1/u);
    expect(example.css).toMatch(/string-set:\s*chapter\s+content\(text\)/u);
  });

  it("documents each fragmentation rule on the element that applies it", () => {
    const example = findGalleryExample("fragmentation");
    const document = new DOMParser().parseFromString(example.html, "text/html");

    expect(
      document.querySelectorAll(".opening-sequence > .flow-copy").length
    ).toBeGreaterThanOrEqual(6);
    expect(document.querySelector(".keep-together")?.textContent).toContain(
      "break-inside: avoid"
    );
    expect(document.querySelector(".break-before-page")?.textContent).toContain(
      "break-before: page"
    );
    expect(document.querySelector(".break-after-page")?.textContent).toContain(
      "break-after: page"
    );
    expect(example.css).toMatch(
      /\.keep-together\s*\{[^}]*break-inside:\s*avoid/u
    );
    expect(example.css).toMatch(
      /\.break-before-page\s*\{[^}]*break-before:\s*page/u
    );
    expect(example.css).toMatch(
      /\.break-after-page\s*\{[^}]*break-after:\s*page/u
    );
    expect(example.features).toContain("break-after");
  });
});
