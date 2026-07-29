import type { Options as Html2CanvasOptions } from "html2canvas";

import { PagedPdfError, throwIfAborted } from "./errors.js";
import type { RasterPage } from "./pdf-writer.js";
import type { ImageFormat } from "./types.js";

const MAX_CAPTURE_PIXELS = 40_000_000;

export interface CaptureOptions {
  readonly pixelRatio: number;
  readonly imageFormat: ImageFormat;
  readonly jpegQuality: number;
  readonly backgroundColor: string | null;
  readonly signal?: AbortSignal;
}

function measureElement(element: HTMLElement): {
  readonly width: number;
  readonly height: number;
} {
  const bounds = element.getBoundingClientRect();
  const computedStyle = getComputedStyle(element);
  const width =
    bounds.width || element.offsetWidth || Number.parseFloat(computedStyle.width);
  const height =
    bounds.height ||
    element.offsetHeight ||
    Number.parseFloat(computedStyle.height);

  if (
    !Number.isFinite(width) ||
    width <= 0 ||
    !Number.isFinite(height) ||
    height <= 0
  ) {
    throw new PagedPdfError(
      "INVALID_PAGE_SIZE",
      "A Paged.js page has no measurable width or height."
    );
  }

  return { width, height };
}

export async function capturePage(
  element: HTMLElement,
  options: CaptureOptions
): Promise<RasterPage> {
  throwIfAborted(options.signal);

  try {
    const size = measureElement(element);
    const capturePixels =
      size.width *
      options.pixelRatio *
      size.height *
      options.pixelRatio;
    if (capturePixels > MAX_CAPTURE_PIXELS) {
      throw new PagedPdfError(
        "LIMIT_EXCEEDED",
        `A page exceeds the ${MAX_CAPTURE_PIXELS.toLocaleString()} pixel capture limit.`
      );
    }

    const { default: html2canvas } = await import("html2canvas");
    const captureOptions: Partial<Html2CanvasOptions> = {
      backgroundColor: options.backgroundColor,
      logging: false,
      scale: options.pixelRatio,
      useCORS: true
    };
    const canvas = await html2canvas(element, captureOptions);
    throwIfAborted(options.signal);
    const mimeType =
      options.imageFormat === "jpeg" ? "image/jpeg" : "image/png";
    const dataUrl = canvas.toDataURL(mimeType, options.jpegQuality);

    return {
      dataUrl,
      widthCssPixels: size.width,
      heightCssPixels: size.height,
      format: options.imageFormat
    };
  } catch (error) {
    if (error instanceof PagedPdfError) {
      throw error;
    }

    throw new PagedPdfError(
      "CAPTURE_FAILED",
      "Unable to capture a Paged.js page. Check image CORS permissions.",
      { cause: error }
    );
  }
}
