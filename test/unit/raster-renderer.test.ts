import { beforeEach, describe, expect, it, vi } from "vitest";

const { html2canvas } = vi.hoisted(() => ({ html2canvas: vi.fn() }));

vi.mock("html2canvas", () => ({ default: html2canvas }));

import { buildRasterPage } from "../../src/raster-renderer.js";

function pageElement(): HTMLElement {
  const page = document.createElement("div");
  page.className = "pagedjs_pagebox";
  vi.spyOn(page, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    right: 600,
    bottom: 800,
    left: 0,
    width: 600,
    height: 800,
    toJSON: () => ({})
  });
  return page;
}

describe("buildRasterPage", () => {
  beforeEach(() => {
    html2canvas.mockReset();
    Object.defineProperty(globalThis, "devicePixelRatio", {
      configurable: true,
      value: 1
    });
    html2canvas.mockResolvedValue({
      toBlob: (callback: BlobCallback, type?: string) => {
        callback(new Blob([new Uint8Array([137, 80, 78, 71])], {
          type: type ?? "image/png"
        }));
      }
    });
  });

  it("turns the rendered page into one full-page image command", async () => {
    const result = await buildRasterPage(pageElement());

    expect(html2canvas).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        allowTaint: false,
        backgroundColor: "#ffffff",
        useCORS: false,
        width: 600,
        height: 800
      })
    );
    expect(result).toMatchObject({
      widthCssPixels: 600,
      heightCssPixels: 800,
      commands: [{
        kind: "image",
        source: expect.stringMatching(new RegExp("^data:image/jpeg;base64,", "u")),
        x: 0,
        y: 0,
        width: 600,
        height: 800
      }]
    });
  });

  it("rejects pages without measurable dimensions", async () => {
    const page = pageElement();
    vi.mocked(page.getBoundingClientRect).mockReturnValue({
      ...page.getBoundingClientRect(),
      width: 0
    });

    await expect(buildRasterPage(page)).rejects.toMatchObject({
      code: "INVALID_PAGE_SIZE"
    });
    expect(html2canvas).not.toHaveBeenCalled();
  });

  it.each([
    { width: Number.NaN, height: 800 },
    { width: 600, height: 0 },
    { width: 600, height: Number.NaN }
  ])("rejects the invalid page bounds %#", async ({ width, height }) => {
    const page = pageElement();
    vi.mocked(page.getBoundingClientRect).mockReturnValue({
      ...page.getBoundingClientRect(),
      width,
      height
    });

    await expect(buildRasterPage(page)).rejects.toMatchObject({
      code: "INVALID_PAGE_SIZE"
    });
    expect(html2canvas).not.toHaveBeenCalled();
  });

  it("uses a nested Paged.js page box for the output dimensions", async () => {
    const root = document.createElement("div");
    root.append(pageElement());

    const result = await buildRasterPage(root);

    expect(result).toMatchObject({
      widthCssPixels: 600,
      heightCssPixels: 800
    });
  });

  it("uses the supplied root when no nested page box exists", async () => {
    const root = pageElement();
    root.className = "page-without-pagebox";

    const result = await buildRasterPage(root);

    expect(result).toMatchObject({
      widthCssPixels: 600,
      heightCssPixels: 800
    });
  });

  it("reports a canvas encoding failure", async () => {
    html2canvas.mockResolvedValue({
      toBlob: (callback: BlobCallback) => callback(null)
    });

    await expect(buildRasterPage(pageElement())).rejects.toMatchObject({
      code: "DOM_TRANSLATION_FAILED"
    });
  });

  it("rejects a rasterized page larger than the image-byte limit", async () => {
    html2canvas.mockResolvedValue({
      toBlob: (callback: BlobCallback) => {
        callback(new Blob([new Uint8Array(10_000_001)]));
      }
    });

    await expect(buildRasterPage(pageElement())).rejects.toMatchObject({
      code: "LIMIT_EXCEEDED"
    });
  });

  it("honors an already aborted conversion", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      buildRasterPage(pageElement(), controller.signal)
    ).rejects.toMatchObject({ code: "ABORTED" });
    expect(html2canvas).not.toHaveBeenCalled();
  });
});
