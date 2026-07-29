import { PagedPdfError } from "./errors.js";
import type {
  ImageFormat,
  PagedDomToPdfOptions,
  PdfMetadata
} from "./types.js";

const DEFAULT_PIXEL_RATIO = 2;
const MAX_PIXEL_RATIO = 4;

export interface NormalizedOptions {
  readonly pixelRatio: number;
  readonly imageFormat: ImageFormat;
  readonly jpegQuality: number;
  readonly backgroundColor: string | null;
  readonly metadata: PdfMetadata;
  readonly signal?: AbortSignal;
  readonly onProgress?: PagedDomToPdfOptions["onProgress"];
}

export function normalizeOptions(
  options: PagedDomToPdfOptions = {}
): NormalizedOptions {
  const pixelRatio = options.pixelRatio ?? DEFAULT_PIXEL_RATIO;
  const jpegQuality = options.jpegQuality ?? 0.92;

  if (
    !Number.isFinite(pixelRatio) ||
    pixelRatio <= 0 ||
    pixelRatio > MAX_PIXEL_RATIO
  ) {
    throw new PagedPdfError(
      "INVALID_OPTION",
      `pixelRatio must be greater than 0 and at most ${MAX_PIXEL_RATIO}.`
    );
  }

  if (
    !Number.isFinite(jpegQuality) ||
    jpegQuality <= 0 ||
    jpegQuality > 1
  ) {
    throw new PagedPdfError(
      "INVALID_OPTION",
      "jpegQuality must be greater than 0 and at most 1."
    );
  }

  return {
    pixelRatio,
    imageFormat: options.imageFormat ?? "png",
    jpegQuality,
    backgroundColor:
      options.backgroundColor === undefined
        ? "#ffffff"
        : options.backgroundColor,
    metadata: options.metadata ?? {},
    signal: options.signal,
    onProgress: options.onProgress
  };
}
