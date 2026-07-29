import { describe, expect, it } from "vitest";

import { prepareHtmlInput } from "../../src/sanitize.js";

describe("additional HTML preparation behavior", () => {
  it("resolves relative URLs while preserving hashes and image data URLs", () => {
    const fragment = prepareHtmlInput(
      `<a href="./chapter">Chapter</a>
       <a id="hash" href="#section">Section</a>
       <img src="data:image/png;base64,AA==">`,
      "https://example.test/book/"
    );

    expect(fragment.querySelector("a")?.getAttribute("href")).toBe(
      "https://example.test/book/chapter"
    );
    expect(fragment.querySelector("#hash")?.getAttribute("href")).toBe(
      "#section"
    );
    expect(fragment.querySelector("img")?.getAttribute("src")).toMatch(
      /^data:image/
    );
  });

  it("removes URLs that cannot be resolved safely", () => {
    const fragment = prepareHtmlInput(
      `<a href="relative">Link</a>`,
      "not a url"
    );
    expect(fragment.querySelector("a")?.hasAttribute("href")).toBe(false);
  });

  it("rejects values outside the public input contract", () => {
    expect(() =>
      prepareHtmlInput({} as unknown as DocumentFragment)
    ).toThrowError(expect.objectContaining({ code: "INVALID_INPUT" }));
  });
});
