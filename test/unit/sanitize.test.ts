import { describe, expect, it } from "vitest";

import { prepareHtmlInput } from "../../src/sanitize.js";

describe("HTML input preparation", () => {
  it("removes active content and unsafe URL attributes", () => {
    const fragment = prepareHtmlInput(`
      <article onclick="alert(1)">
        <script>globalThis.pwned = true</script>
        <iframe src="https://example.com"></iframe>
        <a href="javascript:alert(1)">unsafe</a>
        <img src="data:image/png;base64,AA==" onerror="alert(1)">
      </article>
    `);
    const wrapper = document.createElement("div");
    wrapper.append(fragment);

    expect(wrapper.querySelector("script, iframe")).toBeNull();
    expect(wrapper.querySelector("article")?.hasAttribute("onclick")).toBe(
      false
    );
    expect(wrapper.querySelector("a")?.hasAttribute("href")).toBe(false);
    expect(wrapper.querySelector("img")?.getAttribute("src")).toMatch(
      /^data:image\/png/
    );
    expect(wrapper.querySelector("img")?.hasAttribute("onerror")).toBe(false);
  });

  it("clones caller-owned DOM without mutating it", () => {
    const source = document.createElement("article");
    source.innerHTML = `<p data-marker="original">Hello</p>`;

    const prepared = prepareHtmlInput(source);
    prepared.querySelector("p")?.setAttribute("data-marker", "clone");

    expect(source.querySelector("p")?.getAttribute("data-marker")).toBe(
      "original"
    );
  });
});
