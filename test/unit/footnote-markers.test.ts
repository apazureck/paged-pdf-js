import { describe, expect, it } from "vitest";

import {
  materializeFootnoteMarkers,
  prepareFootnoteLabels
} from "../../demo/footnote-markers.js";

describe("materialized footnote markers", () => {
  it("numbers calls and notes with selectable style variants", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <p>
        Claim<a class="footnote footnote-parenthesized"
          data-footnote-call="first" data-ref="first"></a>
      </p>
      <p>
        Detail<a class="footnote footnote-parenthesized"
          data-footnote-call="second" data-ref="second"></a>
      </p>
      <p>
        Variant<a class="footnote footnote-bracketed"
          data-footnote-call="third" data-ref="third"></a>
      </p>
      <div class="pagedjs_footnote_inner_content">
        <span class="footnote footnote-parenthesized"
          data-footnote-marker="first" data-ref="first">First note.</span>
        <span class="footnote footnote-parenthesized"
          data-footnote-marker="second" data-ref="second">Second note.</span>
        <span class="footnote footnote-bracketed"
          data-footnote-marker="third" data-ref="third">Third note.</span>
      </div>
    `;

    materializeFootnoteMarkers(root);
    materializeFootnoteMarkers(root);

    expect(
      Array.from(
        root.querySelectorAll(".paged-pdf-footnote-call-label"),
        (element) => element.textContent
      )
    ).toEqual(["(1)", "(2)", "[3]"]);
    expect(
      Array.from(
        root.querySelectorAll(".paged-pdf-footnote-note-label"),
        (element) => element.textContent
      )
    ).toEqual(["(1) ", "(2) ", "[3] "]);
    expect(root.querySelectorAll(".paged-pdf-footnote-call-label")).toHaveLength(3);
    expect(root.querySelectorAll(".paged-pdf-footnote-note-label")).toHaveLength(3);
  });

  it("reserves the final label width before pagination", () => {
    const root = document.createElement("div");
    root.innerHTML = Array.from(
      { length: 12 },
      (_, index) => `<span class="footnote ${index < 10
        ? "footnote-parenthesized"
        : "footnote-bracketed"}"></span>`
    ).join("");

    prepareFootnoteLabels(root);

    expect(
      Array.from(
        root.querySelectorAll<HTMLElement>(".footnote"),
        (element) => element.dataset.footnoteLabel
      )
    ).toEqual([
      "(1)", "(2)", "(3)", "(4)", "(5)", "(6)",
      "(7)", "(8)", "(9)", "(10)", "[11]", "[12]"
    ]);
  });});
