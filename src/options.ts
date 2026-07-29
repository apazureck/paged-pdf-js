import type { PagedDomToPdfOptions, PdfMetadata } from "./types.js";

export interface NormalizedOptions {
  readonly metadata: PdfMetadata;
  readonly signal?: AbortSignal;
  readonly onProgress?: PagedDomToPdfOptions["onProgress"];
}

export function normalizeOptions(
  options: PagedDomToPdfOptions = {}
): NormalizedOptions {
  return {
    metadata: options.metadata ?? {},
    signal: options.signal,
    onProgress: options.onProgress
  };
}
