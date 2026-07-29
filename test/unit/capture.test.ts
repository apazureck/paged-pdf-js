import { beforeEach, describe, expect, it, vi } from "vitest";

const html2canvasMock = vi.hoisted(() => vi.fn());

vi.mock("html2canvas", () => ({
  default: html2canvasMock
}));

import { capturePage } from "../../src/capture.js";

const DEFAULT_OPTIONS = {
  pixelRatio: 2,
  imageFormat: "png" as const,
  jpegQuality: 0.92,
  backgroundColor: "#fff"
};

describe("page capture", () => {
  beforeEach(() => {
    html2canvasMock.mockReset();
  });

  it("captures a measured element with html2canvas", async () => {
    const element = document.createElement("section");
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      right: 816,
      bottom: 1056,
      left: 0,
      width: 816,
      height: 1056,
      toJSON: () => ({})
    });
    const toDataURL = vi
      .fn()
      .mockReturnValue("data:image/png;base64,captured");
    html2canvasMock.mockResolvedValue({ toDataURL });

    await expect(capturePage(element, DEFAULT_OPTIONS)).resolves.toEqual({
      dataUrl: "data:image/png;base64,captured",
      widthCssPixels: 816,
      heightCssPixels: 1056,
      format: "png"
    });
    expect(html2canvasMock).toHaveBeenCalledWith(
      element,
      expect.objectContaining({
        backgroundColor: "#fff",
        logging: false,
        scale: 2,
        useCORS: true
      })
    );
    expect(toDataURL).toHaveBeenCalledWith("image/png", 0.92);
  });

  it("uses computed CSS dimensions and JPEG output as fallbacks", async () => {
    const element = document.createElement("section");
    element.style.width = "320px";
    element.style.height = "240px";
    const toDataURL = vi
      .fn()
      .mockReturnValue("data:image/jpeg;base64,captured");
    html2canvasMock.mockResolvedValue({ toDataURL });

    const result = await capturePage(element, {
      ...DEFAULT_OPTIONS,
      imageFormat: "jpeg"
    });

    expect(result).toMatchObject({
      widthCssPixels: 320,
      heightCssPixels: 240,
      format: "jpeg"
    });
    expect(toDataURL).toHaveBeenCalledWith("image/jpeg", 0.92);
  });

  it("rejects pages without measurable dimensions", async () => {
    await expect(
      capturePage(document.createElement("section"), DEFAULT_OPTIONS)
    ).rejects.toMatchObject({ code: "INVALID_PAGE_SIZE" });
  });

  it("wraps canvas failures and preserves abort errors", async () => {
    const element = document.createElement("section");
    element.style.width = "100px";
    element.style.height = "100px";
    html2canvasMock.mockRejectedValueOnce(new Error("tainted"));

    await expect(capturePage(element, DEFAULT_OPTIONS)).rejects.toMatchObject({
      code: "CAPTURE_FAILED",
      message: expect.stringMatching(/CORS/)
    });

    const controller = new AbortController();
    controller.abort();
    await expect(
      capturePage(element, { ...DEFAULT_OPTIONS, signal: controller.signal })
    ).rejects.toMatchObject({ code: "ABORTED" });
  });
});
