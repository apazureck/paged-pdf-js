import { describe, expect, it, vi } from "vitest";

import {
  PagedPdfError,
  throwIfAborted,
  toPagedPdfError
} from "../../src/errors.js";
import { normalizeOptions } from "../../src/options.js";

describe("option normalization", () => {
  it("applies safe defaults", () => {
    expect(normalizeOptions()).toMatchObject({
      pixelRatio: 2,
      imageFormat: "png",
      jpegQuality: 0.92,
      backgroundColor: "#ffffff",
      metadata: {}
    });
  });

  it("preserves valid immutable options", () => {
    const onProgress = vi.fn();
    const controller = new AbortController();
    const metadata = { title: "Example" };

    expect(
      normalizeOptions({
        pixelRatio: 3,
        imageFormat: "jpeg",
        jpegQuality: 0.8,
        backgroundColor: null,
        metadata,
        signal: controller.signal,
        onProgress
      })
    ).toEqual({
      pixelRatio: 3,
      imageFormat: "jpeg",
      jpegQuality: 0.8,
      backgroundColor: null,
      metadata,
      signal: controller.signal,
      onProgress
    });
  });

  it.each([0, -1, 4.1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid pixelRatio %s",
    (pixelRatio) => {
      expect(() => normalizeOptions({ pixelRatio })).toThrowError(
        expect.objectContaining({ code: "INVALID_OPTION" })
      );
    }
  );

  it.each([0, -1, 1.1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid jpegQuality %s",
    (jpegQuality) => {
      expect(() => normalizeOptions({ jpegQuality })).toThrowError(
        expect.objectContaining({ code: "INVALID_OPTION" })
      );
    }
  );
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
