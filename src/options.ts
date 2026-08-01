import type { PagedDomToPdfOptions, PdfMetadata, RenderMode } from "./types.js";

export interface NormalizedOptions {
  readonly metadata: PdfMetadata;
  readonly renderMode: RenderMode;
  readonly signal?: AbortSignal;
  readonly onProgress?: PagedDomToPdfOptions["onProgress"];
}

export function normalizeOptions(
  options: PagedDomToPdfOptions = {}
): NormalizedOptions {
  return {
    metadata: options.metadata ?? {},
    renderMode: options.renderMode ?? "vector",
    signal: options.signal,
    onProgress: options.onProgress
  };
}
