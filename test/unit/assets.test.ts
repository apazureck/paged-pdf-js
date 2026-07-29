import { beforeEach, describe, expect, it, vi } from "vitest";

import { waitForAssets } from "../../src/assets.js";

describe("asset readiness", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: Promise.resolve() }
    });
  });

  it("waits for document fonts and decodes incomplete images", async () => {
    const image = document.createElement("img");
    const decode = vi.fn().mockResolvedValue(undefined);
    Object.defineProperties(image, {
      complete: { configurable: true, value: false },
      decode: { configurable: true, value: decode }
    });
    document.body.append(image);

    await waitForAssets(document.body);

    expect(decode).toHaveBeenCalledOnce();
  });

  it("skips decoding complete images with intrinsic dimensions", async () => {
    const image = document.createElement("img");
    const decode = vi.fn();
    Object.defineProperties(image, {
      complete: { configurable: true, value: true },
      naturalWidth: { configurable: true, value: 10 },
      decode: { configurable: true, value: decode }
    });
    document.body.append(image);

    await waitForAssets(document.body);

    expect(decode).not.toHaveBeenCalled();
  });

  it("reports an actionable image error", async () => {
    const image = document.createElement("img");
    image.src = "https://assets.example.test/missing.png";
    Object.defineProperties(image, {
      complete: { configurable: true, value: false },
      decode: {
        configurable: true,
        value: vi.fn().mockRejectedValue(new Error("decode failed"))
      }
    });
    document.body.append(image);

    await expect(waitForAssets(document.body)).rejects.toMatchObject({
      code: "ASSET_ERROR",
      message: expect.stringContaining("missing.png")
    });
  });

  it("stops immediately when aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      waitForAssets(document.body, controller.signal)
    ).rejects.toMatchObject({ code: "ABORTED" });
  });
});
