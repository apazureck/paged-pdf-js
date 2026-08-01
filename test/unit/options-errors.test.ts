import { describe, expect, it, vi } from "vitest";

import {
  PagedPdfError,
  throwIfAborted,
  toPagedPdfError
} from "../../src/errors.js";
import { normalizeOptions } from "../../src/options.js";

describe("option normalization", () => {
  it("applies safe defaults", () => {
    expect(normalizeOptions()).toEqual({ metadata: {}, renderMode: "vector" });
  });

  it("preserves valid immutable options", () => {
    const onProgress = vi.fn();
    const controller = new AbortController();
    const metadata = { title: "Example" };

    expect(
      normalizeOptions({
        metadata,
        signal: controller.signal,
        onProgress,
        renderMode: "hybrid"
      })
    ).toEqual({
      metadata,
      signal: controller.signal,
      onProgress,
      renderMode: "hybrid"
    });
  });
});

describe("error helpers", () => {
  it("throws an ABORTED error with the abort reason", () => {
    const controller = new AbortController();
    controller.abort("cancelled");

    expect(() => throwIfAborted(controller.signal)).toThrowError(
      expect.objectContaining({ code: "ABORTED", cause: "cancelled" })
    );
  });

  it("does nothing for an active or missing signal", () => {
    expect(() => throwIfAborted()).not.toThrow();
    expect(() => throwIfAborted(new AbortController().signal)).not.toThrow();
  });

  it("preserves library errors and wraps unknown errors", () => {
    const existing = new PagedPdfError("NO_PAGES", "No pages");
    expect(toPagedPdfError(existing, "PDF_WRITE_FAILED", "ignored")).toBe(
      existing
    );

    const cause = new Error("low level");
    expect(
      toPagedPdfError(cause, "PDF_WRITE_FAILED", "Friendly message")
    ).toMatchObject({
      code: "PDF_WRITE_FAILED",
      message: "Friendly message",
      cause
    });
  });
});
