import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assertNoCssResourceUrls,
  materializeImageResources
} from "../../src/image-materializer.js";
import { loadImageResource } from "../../src/image-loader.js";

const SINGLE_PIXEL_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function dataUrl(bytes: Uint8Array, mimeType: string): string {
  const binary = Array.from(bytes, (value) => String.fromCharCode(value)).join("");
  return `data:${mimeType};base64,${btoa(binary)}`;
}

describe("image resource validation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("detects a baseline JPEG from its markers", async () => {
    const jpeg = Uint8Array.from([
      0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x01, 0x00, 0x01,
      0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00
    ]);

    await expect(loadImageResource(dataUrl(jpeg, "image/jpeg"))).resolves
      .toMatchObject({ format: "JPEG", width: 1, height: 1 });
  });

  it("rejects invalid base64 and oversized image dimensions", async () => {
    await expect(
      loadImageResource("data:image/png;base64,%%%")
    ).rejects.toMatchObject({ code: "IMAGE_ERROR" });

    const png = new Uint8Array(24);
    png.set([137, 80, 78, 71, 13, 10, 26, 10]);
    const view = new DataView(png.buffer);
    view.setUint32(16, 10_001);
    view.setUint32(20, 1);
    await expect(
      loadImageResource(dataUrl(png, "image/png"))
    ).rejects.toMatchObject({ code: "LIMIT_EXCEEDED" });
  });

  it("requests remote bytes with redirects disabled", async () => {
    const pngBytes = Uint8Array.from(
      atob(SINGLE_PIXEL_PNG.split(",")[1] ?? ""),
      (character) => character.charCodeAt(0)
    );
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(pngBytes, { status: 200 }));

    await loadImageResource("https://example.test/image?id=1");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/image?id=1",
      expect.objectContaining({ redirect: "error" })
    );
  });

  it("honors an already-aborted request", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      loadImageResource(SINGLE_PIXEL_PNG, controller.signal)
    ).rejects.toMatchObject({ code: "ABORTED" });
  });
});

describe("sanitized image materialization", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("rejects URL-bearing CSS before rendering", () => {
    expect(() =>
      assertNoCssResourceUrls("main{background:url(https://example.test/a.png)}")
    ).toThrowError(expect.objectContaining({ code: "INVALID_INPUT" }));
    expect(() => assertNoCssResourceUrls("main{color:red}")).not.toThrow();
  });

  it("materializes validated bytes as a local blob and revokes it", async () => {
    const fragment = document.createDocumentFragment();
    const image = document.createElement("img");
    image.src = SINGLE_PIXEL_PNG;
    image.srcset = `${SINGLE_PIXEL_PNG} 1x`;
    fragment.append(image);
    const createObjectUrl = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:validated-image");
    const revokeObjectUrl = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);

    const cleanup = await materializeImageResources(fragment);

    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(image.src).toBe("blob:validated-image");
    expect(image.hasAttribute("srcset")).toBe(false);
    cleanup();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:validated-image");
  });

  it("removes unused URL-bearing and SVG resource attributes", async () => {
    const fragment = document.createDocumentFragment();
    const box = document.createElement("div");
    box.setAttribute("style", "background:url(https://example.test/a.png)");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "https://example.test/icons.svg#mark");
    svg.append(use);
    fragment.append(box, svg);

    const cleanup = await materializeImageResources(fragment);

    expect(box.hasAttribute("style")).toBe(false);
    expect(use.hasAttribute("href")).toBe(false);
    cleanup();
  });

  it("rejects excessive image counts before decoding", async () => {
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 101; index += 1) {
      fragment.append(document.createElement("img"));
    }

    await expect(materializeImageResources(fragment)).rejects.toMatchObject({
      code: "LIMIT_EXCEEDED"
    });
  });
});
