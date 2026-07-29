import { PagedPdfError } from "./errors.js";

const PDF_POINTS_PER_CSS_PIXEL = 72 / 96;

export function cssPixelsToPoints(cssPixels: number): number {
  if (!Number.isFinite(cssPixels) || cssPixels < 0) {
    throw new PagedPdfError(
      "INVALID_PAGE_SIZE",
      "CSS pixel values must be non-negative finite numbers."
    );
  }
  return cssPixels * PDF_POINTS_PER_CSS_PIXEL;
}
