import { describe, expect, it, vi } from "vitest";

import { waitForAssets } from "../../src/assets.js";
import { prepareHtmlInput } from "../../src/sanitize.js";

describe("release regression coverage", () => {
  it("stops while image decoding is still pending", async () => {
    const controller = new AbortController();
    const image = document.createElement("img");
    Object.defineProperties(image, {
      complete: { configurable: true, value: false },
      decode: {
        configurable: true,
        value: vi.fn().mockReturnValue(new Promise(() => undefined))
      }
    });
    document.body.append(image);

    const readiness = waitForAssets(document.body, controller.signal);
    controller.abort("cancelled");

    await expect(readiness).rejects.toMatchObject({ code: "ABORTED" });
    image.remove();
  });

  it("resolves srcset candidates and inline CSS URLs", () => {
    const fragment = prepareHtmlInput(
      `<img
        srcset="small.png 1x, large.png 2x"
        style="background-image: url('./paper.png')"
      >`,
      "https://example.test/book/",
      ["https://example.test"]
    );
    const image = fragment.querySelector("img");

    expect(image?.getAttribute("srcset")).toBe(
      "https://example.test/book/small.png 1x, https://example.test/book/large.png 2x"
    );
    expect(image?.getAttribute("style")).toContain(
      "https://example.test/book/paper.png"
    );
  });

  it("removes unsafe responsive and inline CSS URLs", () => {
    const fragment = prepareHtmlInput(
      `<img
        srcset="javascript:alert(1) 1x, safe.png 2x"
        style="background-image: url('javascript:alert(1)')"
      >`,
      "https://example.test/",
      ["https://example.test"]
    );
    const image = fragment.querySelector("img");

    expect(image?.getAttribute("srcset")).toBe(
      "https://example.test/safe.png 2x"
    );
    expect(image?.hasAttribute("style")).toBe(false);
  });
});
