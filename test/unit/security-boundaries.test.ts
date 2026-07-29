import { describe, expect, it } from "vitest";

import {
  prepareHtmlInput,
  prepareStyleText
} from "../../src/sanitize.js";

describe("security boundaries", () => {
  it("unwraps custom elements and removes customized built-ins", () => {
    const fragment = prepareHtmlInput(
      `<security-probe><p>Preserved text</p></security-probe>
       <button is="danger-button">Button</button>`
    );

    expect(fragment.querySelector("security-probe")).toBeNull();
    expect(fragment.querySelector("p")?.textContent).toBe("Preserved text");
    expect(fragment.querySelector("button")?.hasAttribute("is")).toBe(false);
  });

  it("blocks cross-origin resources by default and permits an allowlist", () => {
    const blocked = prepareHtmlInput(
      `<img src="https://cdn.example.test/page.png">`,
      document.location.href
    );
    const allowed = prepareHtmlInput(
      `<img src="https://cdn.example.test/page.png">`,
      document.location.href,
      ["https://cdn.example.test"]
    );

    expect(blocked.querySelector("img")?.hasAttribute("src")).toBe(false);
    expect(allowed.querySelector("img")?.src).toBe(
      "https://cdn.example.test/page.png"
    );
  });

  it("allows raster data images but rejects SVG data images", () => {
    const fragment = prepareHtmlInput(`
      <img id="png" src="data:image/png;base64,AA==">
      <img id="svg" src="data:image/svg+xml,%3Csvg/%3E">
    `);

    expect(fragment.querySelector("#png")?.hasAttribute("src")).toBe(true);
    expect(fragment.querySelector("#svg")?.hasAttribute("src")).toBe(false);
  });

  it("rejects escaped CSS URLs outside the allowlist", () => {
    expect(() =>
      prepareStyleText(
        String.raw`p { background-image: u\72l(https://tracker.example.test/pixel); }`,
        document.location.href,
        []
      )
    ).toThrowError(expect.objectContaining({ code: "INVALID_INPUT" }));
  });

  it("rejects CSS imports instead of trusting nested resources", () => {
    expect(() =>
      prepareStyleText(
        `@import "https://cdn.example.test/print.css";`,
        document.location.href,
        ["https://cdn.example.test"]
      )
    ).toThrowError(expect.objectContaining({ code: "INVALID_INPUT" }));
  });

  it("applies the resource policy to SVG href attributes", () => {
    const fragment = prepareHtmlInput(`
      <svg xmlns="http://www.w3.org/2000/svg">
        <image href="https://tracker.example.test/pixel.png"></image>
        <a href="https://example.test/chapter"><text>Chapter</text></a>
      </svg>
    `);

    expect(fragment.querySelector("image")?.hasAttribute("href")).toBe(false);
    expect(fragment.querySelector("a")?.hasAttribute("href")).toBe(true);
  });
});
