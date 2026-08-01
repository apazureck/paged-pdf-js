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

  it("pairs the long-form title page with a public-domain cover", () => {
    const example = findGalleryExample("running-content");
    const document = new DOMParser().parseFromString(example.html, "text/html");
    const sections = document.querySelectorAll(".book > section");
    const coverPage = sections[0];
    const cover = document.querySelector<HTMLImageElement>(".book-cover");

    expect(coverPage?.classList.contains("cover-page")).toBe(true);
    expect(coverPage?.children).toHaveLength(1);
    expect(coverPage?.textContent?.trim()).toBe("");
    expect(cover?.getAttribute("src")).toBe(
      "/media/alice-wonderland-1907-cover.jpg"
    );
    expect(cover?.alt).toContain("1907 cover");
    expect(sections[1]?.classList.contains("title-page")).toBe(true);
    expect(sections[1]?.textContent).toContain(
      "Long-form typesetting specimen"
    );
    expect(sections[2]?.classList.contains("contents-page")).toBe(true);
    expect(sections[2]?.textContent).toContain("Three chapters");
    expect(example.html).toContain("commons.wikimedia.org");
    expect(example.css).toMatch(
      /@page\s+cover\s*\{[^}]*margin:\s*0/u
    );
  });

  it("places every footnote style label in the top page margin", () => {
    const example = findGalleryExample("footnotes");
    const document = new DOMParser().parseFromString(example.html, "text/html");

    expect(
      document.querySelectorAll(".footnote-style-page > .eyebrow")
    ).toHaveLength(3);
    expect(example.css).toMatch(
      /@top-left\s*\{[^}]*content:\s*string\(footnote-style-title\)/u
    );
    expect(example.css).toMatch(
      /\.footnote-style-page\s*>\s*\.eyebrow\s*\{[^}]*string-set:\s*footnote-style-title\s+content\(text\)/u
    );
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
