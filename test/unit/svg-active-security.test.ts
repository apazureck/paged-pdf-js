import { describe, expect, it } from "vitest";

import { prepareHtmlInput } from "../../src/sanitize.js";

describe("active SVG security", () => {
  it("removes SMIL mutation and disallowed presentation URLs", () => {
    const fragment = prepareHtmlInput(
      `<svg xmlns="http://www.w3.org/2000/svg">
        <image id="target"></image>
        <set href="#target" attributeName="href"
          to="https://tracker.invalid/smil.png" begin="0s"></set>
        <rect fill="url(https://tracker.invalid/paint.svg#p)"></rect>
      </svg>`
    );

    expect(fragment.querySelector("set")).toBeNull();
    expect(fragment.querySelector("rect")?.hasAttribute("fill")).toBe(false);
  });

  it("preserves non-URL SVG presentation values", () => {
    const fragment = prepareHtmlInput(
      `<svg xmlns="http://www.w3.org/2000/svg">
        <rect fill="#123456" stroke="none"></rect>
      </svg>`
    );

    expect(fragment.querySelector("rect")?.getAttribute("fill")).toBe("#123456");
    expect(fragment.querySelector("rect")?.getAttribute("stroke")).toBe("none");
  });
});
