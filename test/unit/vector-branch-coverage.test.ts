import { afterEach, describe, expect, it, vi } from "vitest";

import { parseCssColor } from "../../src/css-color.js";
import { buildVectorPage } from "../../src/dom-renderer.js";
import { loadImageResource } from "../../src/image-loader.js";

function bounds(width: number, height: number): DOMRect {
  return {
    left: 0,
    top: 0,
    width,
    height,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({})
  };
}

describe("vector renderer edge cases", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("handles alpha percentages and invalid alpha values", () => {
    expect(parseCssColor("rgb(1 2 3 / 50%)")).toEqual([1, 2, 3]);
    expect(parseCssColor("rgba(1, 2, 3, nope)")).toBeUndefined();
  });

  it("rejects unmeasurable pages", async () => {
    const page = document.createElement("div");
    await expect(buildVectorPage(page)).rejects.toMatchObject({
      code: "INVALID_PAGE_SIZE"
    });
  });

  it("preserves image candidates but omits unsafe links", async () => {
    const page = document.createElement("div");
    const image = document.createElement("img");
    image.src = "data:image/svg+xml;base64,PHN2Zy8+";
    const link = document.createElement("a");
    link.href = "javascript:alert(1)";
    link.textContent = "";
    page.append(image, link);
    document.body.append(page);
    vi.spyOn(page, "getBoundingClientRect").mockReturnValue(bounds(200, 300));
    vi.spyOn(image, "getBoundingClientRect").mockReturnValue(bounds(20, 20));
    vi.spyOn(link, "getBoundingClientRect").mockReturnValue(bounds(20, 20));
    vi.spyOn(link, "getClientRects").mockReturnValue(
      [bounds(20, 20)] as unknown as DOMRectList
    );

    const result = await buildVectorPage(page);
    expect(result.commands).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "image" })])
    );
    expect(result.commands).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "link" })])
    );
  });
});

describe("image loader limits", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects non-base64 data URLs", async () => {
    await expect(
      loadImageResource("data:image/png,raw")
    ).rejects.toMatchObject({ code: "IMAGE_ERROR" });
  });

  it("preserves typed response-size errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { "content-length": "10000001" }
      })
    );

    await expect(
      loadImageResource("https://example.test/large.png")
    ).rejects.toMatchObject({ code: "LIMIT_EXCEEDED" });
  });
});
