import { PagedPdfError } from "./errors.js";

const PDF_POINTS_PER_CSS_PIXEL = 72 / 96;

export interface CssSize {
  readonly width: number;
  readonly height: number;
}

export interface CssRectangle extends CssSize {
  readonly left: number;
  readonly top: number;
}

export interface PdfRectangle extends CssSize {
  readonly x: number;
  readonly y: number;
}

export function cssPixelsToPoints(cssPixels: number): number {
  if (!Number.isFinite(cssPixels) || cssPixels <= 0) {
    throw new PagedPdfError(
      "INVALID_PAGE_SIZE",
      "CSS pixel values must be positive finite numbers."
    );
  }

  return cssPixels * PDF_POINTS_PER_CSS_PIXEL;
}

export function pageRectangleToPdf(
  rectangle: CssRectangle,
  page: CssSize
): PdfRectangle {
  const x = cssPixelsToPoints(rectangle.left);
  const width = cssPixelsToPoints(rectangle.width);
  const height = cssPixelsToPoints(rectangle.height);
  const y = cssPixelsToPoints(page.height - rectangle.top - rectangle.height);

  return { x, y, width, height };
}
