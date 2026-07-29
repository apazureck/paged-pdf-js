import { afterEach, describe, expect, it, vi } from "vitest";

import { loadImageResource } from "../../src/image-loader.js";

const SINGLE_PIXEL_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const SINGLE_PIXEL_PNG_BYTES = Uint8Array.from(
  atob(SINGLE_PIXEL_PNG.split(",")[1] ?? ""),
  (character) => character.charCodeAt(0)
);

describe("direct image byte loading", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("decodes and validates base64 image data without a canvas", async () => {
    await expect(loadImageResource(SINGLE_PIXEL_PNG)).resolves.toMatchObject({
      bytes: SINGLE_PIXEL_PNG_BYTES,
      format: "PNG",
      width: 1,
      height: 1
    });
  });

  it("detects remote image format from bytes instead of its URL", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(SINGLE_PIXEL_PNG_BYTES, {
        status: 200,
        headers: { "content-type": "application/octet-stream" }
      })
    );

    await expect(
      loadImageResource("https://example.test/image?id=1")
    ).resolves.toMatchObject({ format: "PNG", width: 1, height: 1 });
  });

  it("rejects unsupported or malformed image bytes", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([4, 5, 6]), { status: 200 })
    );

    await expect(
      loadImageResource("https://example.test/image")
    ).rejects.toMatchObject({ code: "IMAGE_ERROR" });
  });

  it("reports failed image requests", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 404 })
    );

    await expect(
      loadImageResource("https://example.test/missing.png")
    ).rejects.toMatchObject({ code: "IMAGE_ERROR" });
  });
});
