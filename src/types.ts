export type ProgressPhase = "paginate" | "assets" | "render" | "write";
export type RenderMode = "hybrid" | "raster" | "vector";

export interface ConversionProgress {
  readonly phase: ProgressPhase;
  readonly page?: number;
  readonly totalPages?: number;
}

export interface PdfMetadata {
  readonly title?: string;
  readonly author?: string;
  readonly subject?: string;
  readonly keywords?: readonly string[];
}

export interface PagedDomToPdfOptions {
  readonly metadata?: PdfMetadata;
  readonly renderMode?: RenderMode;
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: ConversionProgress) => void;
}

export interface HtmlToPdfOptions extends PagedDomToPdfOptions {
  /** @deprecated External stylesheets are rejected. Pass CSS through styleText. */
  readonly stylesheets?: readonly string[];
  readonly styleText?: string;
  readonly baseUrl?: string;
  readonly allowedResourceOrigins?: readonly string[];
}

export interface PdfResult {
  readonly bytes: Uint8Array;
  readonly pageCount: number;
  readonly blob: Blob;
}

export type PagedPdfErrorCode =
  | "ABORTED"
  | "ASSET_ERROR"
  | "BROWSER_REQUIRED"
  | "DOM_TRANSLATION_FAILED"
  | "IMAGE_ERROR"
  | "INVALID_INPUT"
  | "INVALID_OPTION"
  | "INVALID_PAGE_SIZE"
  | "LIMIT_EXCEEDED"
  | "NO_PAGES"
  | "PAGINATION_FAILED"
  | "PDF_WRITE_FAILED";
