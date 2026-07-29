import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { downloadPdf } from "../../src/download.js";

describe("PDF download helper", () => {
  const createObjectURL = vi.fn(() => "blob:test-pdf");
  const revokeObjectURL = vi.fn();
  let click: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.replaceChildren();
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: createObjectURL },
      revokeObjectURL: { configurable: true, value: revokeObjectURL }
    });
    click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
  });

  it("downloads bytes with a normalized PDF filename and revokes the URL", () => {
    downloadPdf(new Uint8Array([1, 2, 3]), "report");

    expect(createObjectURL).toHaveBeenCalledWith(
      expect.objectContaining({ type: "application/pdf" })
    );
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector("a")).toBeNull();
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test-pdf");
  });

  it("accepts a Blob and keeps an existing PDF extension", () => {
    downloadPdf(new Blob(["pdf"], { type: "application/pdf" }), "report.PDF");
    expect(click).toHaveBeenCalledOnce();
  });

  it("requires a browser document", () => {
    vi.stubGlobal("document", undefined);
    expect(() => downloadPdf(new Uint8Array())).toThrowError(
      expect.objectContaining({ code: "BROWSER_REQUIRED" })
    );
    vi.unstubAllGlobals();
  });
});
