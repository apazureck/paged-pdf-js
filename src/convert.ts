import { waitForAssets } from "./assets.js";
import { capturePage } from "./capture.js";
import {
  PagedPdfError,
  throwIfAborted,
  toPagedPdfError,
  waitWithAbort
} from "./errors.js";
import { normalizeOptions, type NormalizedOptions } from "./options.js";
import { collectPagedSheets } from "./paged-dom.js";
import { writeRasterPdf } from "./pdf-writer.js";
import { prepareHtmlInput, prepareStyleText } from "./sanitize.js";
import type {
  HtmlToPdfOptions,
  PagedDomToPdfOptions,
  PdfResult
} from "./types.js";

const MAX_PAGES = 100;
const MAX_TOTAL_CAPTURE_PIXELS = 200_000_000;
const MAX_OUTPUT_BYTES = 100_000_000;
const CONVERSION_TIMEOUT_MS = 60_000;
const OFFSCREEN_RENDER_STYLE = [
  "all:initial",
  "position:fixed",
  "left:-100000px",
  "top:0",
  "visibility:visible",
  "pointer-events:none",
  "z-index:-2147483648"
].join(";");

interface PagedPreviewer {
  readonly polisher?: {
    readonly inserted?: readonly HTMLStyleElement[];
    readonly styleEl?: HTMLStyleElement;
    destroy: () => void;
  };
  readonly chunker?: {
    readonly hooks?: {
      readonly beforeParsed?: {
        register: (callback: () => void) => void;
      };
    };
    stop?: () => void;
  };
  preview: (
    content: DocumentFragment,
    stylesheets: Array<string | Record<string, string>>,
    renderTo: HTMLElement
  ) => Promise<unknown>;
}

function requireBrowser(): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new PagedPdfError(
      "BROWSER_REQUIRED",
      "paged-pdf-js requires a browser DOM when conversion is invoked."
    );
  }
}

function operationSignal(signal?: AbortSignal): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(CONVERSION_TIMEOUT_MS);
  return signal === undefined
    ? timeoutSignal
    : AbortSignal.any([signal, timeoutSignal]);
}

function createResult(bytes: Uint8Array, pageCount: number): PdfResult {
  if (bytes.byteLength > MAX_OUTPUT_BYTES) {
    throw new PagedPdfError(
      "LIMIT_EXCEEDED",
      `The PDF exceeds the ${MAX_OUTPUT_BYTES.toLocaleString()} byte output limit.`
    );
  }
  const stableBytes = new Uint8Array(bytes);
  return {
    bytes: stableBytes,
    pageCount,
    blob: new Blob([stableBytes], { type: "application/pdf" })
  };
}

async function convertPagedDom(
  pagedRoot: ParentNode,
  normalized: NormalizedOptions
): Promise<PdfResult> {
  throwIfAborted(normalized.signal);
  const pages = collectPagedSheets(pagedRoot);
  if (pages.length > MAX_PAGES) {
    throw new PagedPdfError(
      "LIMIT_EXCEEDED",
      `Paged output exceeds the ${MAX_PAGES} page limit.`
    );
  }

  normalized.onProgress?.({
    phase: "assets",
    totalPages: pages.length
  });
  await waitForAssets(pagedRoot, normalized.signal);
  let totalCapturePixels = 0;

  async function* rasterPages() {
    for (const [index, page] of pages.entries()) {
      throwIfAborted(normalized.signal);
      normalized.onProgress?.({
        phase: "render",
        page: index + 1,
        totalPages: pages.length
      });
      const captured = await capturePage(page, normalized);
      totalCapturePixels +=
        captured.widthCssPixels *
        normalized.pixelRatio *
        captured.heightCssPixels *
        normalized.pixelRatio;
      if (totalCapturePixels > MAX_TOTAL_CAPTURE_PIXELS) {
        throw new PagedPdfError(
          "LIMIT_EXCEEDED",
          `The document exceeds the ${MAX_TOTAL_CAPTURE_PIXELS.toLocaleString()} total capture pixel limit.`
        );
      }
      yield captured;
    }
  }

  const bytes = await writeRasterPdf(rasterPages(), {
    ...normalized.metadata,
    signal: normalized.signal,
    onPageWritten: (page) => {
      normalized.onProgress?.({
        phase: "write",
        page,
        totalPages: pages.length
      });
    }
  });

  return createResult(bytes, pages.length);
}

export async function pagedDomToPdf(
  pagedRoot: ParentNode,
  options: PagedDomToPdfOptions = {}
): Promise<PdfResult> {
  requireBrowser();
  const normalized = normalizeOptions({
    ...options,
    signal: operationSignal(options.signal)
  });
  return await convertPagedDom(pagedRoot, normalized);
}

function createRenderBoundary(): {
  readonly container: HTMLElement;
  readonly host: HTMLElement;
  readonly shadowRoot: ShadowRoot;
} {
  const container = document.createElement("div");
  container.dataset.pagedPdfRenderHost = "";
  container.setAttribute("style", OFFSCREEN_RENDER_STYLE);
  const shadowRoot = container.attachShadow({ mode: "open" });
  const host = document.createElement("body");
  host.style.margin = "0";
  shadowRoot.append(host);
  document.body.append(container);
  return { container, host, shadowRoot };
}

function isolatePagedStyles(
  previewer: PagedPreviewer,
  shadowRoot: ShadowRoot
): () => void {
  const moveStyles = () => {
    const inserted = [...(previewer.polisher?.inserted ?? [])];
    const dynamic = previewer.polisher?.styleEl;
    const orderedStyles =
      dynamic === undefined
        ? inserted
        : [inserted[0], dynamic, ...inserted.slice(1)].filter(
            (style): style is HTMLStyleElement => style !== undefined
          );

    for (const styleElement of inserted) {
      if (styleElement.dataset.pagedPdfShadowReady === undefined) {
        styleElement.textContent =
          styleElement.textContent?.replaceAll(":root", ":host") ?? "";
        styleElement.dataset.pagedPdfShadowReady = "";
      }
    }
    shadowRoot.prepend(...orderedStyles);
  };

  previewer.chunker?.hooks?.beforeParsed?.register(moveStyles);
  return moveStyles;
}

export async function htmlToPdf(
  input: string | Element | DocumentFragment,
  options: HtmlToPdfOptions = {}
): Promise<PdfResult> {
  requireBrowser();
  if ((options.stylesheets?.length ?? 0) > 0) {
    throw new PagedPdfError(
      "INVALID_OPTION",
      "External stylesheets are not supported. Pass validated CSS through styleText."
    );
  }

  const signal = operationSignal(options.signal);
  const normalized = normalizeOptions({ ...options, signal });
  throwIfAborted(signal);
  const content = prepareHtmlInput(
    input,
    options.baseUrl,
    options.allowedResourceOrigins
  );
  const preparedStyleText =
    options.styleText === undefined
      ? undefined
      : prepareStyleText(
          options.styleText,
          options.baseUrl,
          options.allowedResourceOrigins
        );
  const { container, host, shadowRoot } = createRenderBoundary();
  let previewer: PagedPreviewer | undefined;

  try {
    normalized.onProgress?.({ phase: "paginate" });
    const pagedModule = await import("pagedjs");
    previewer = new pagedModule.Previewer() as PagedPreviewer;
    const movePagedStyles = isolatePagedStyles(previewer, shadowRoot);
    const stylesheets: Array<string | Record<string, string>> = [];

    if (preparedStyleText !== undefined) {
      stylesheets.push({
        [options.baseUrl ?? document.location.href]: preparedStyleText
      });
    }

    const stopPagination = () => previewer?.chunker?.stop?.();
    signal.addEventListener("abort", stopPagination, { once: true });
    try {
      await waitWithAbort(previewer.preview(content, stylesheets, host), signal);
    } finally {
      signal.removeEventListener("abort", stopPagination);
    }
    movePagedStyles();
    return await convertPagedDom(host, normalized);
  } catch (error) {
    throw toPagedPdfError(
      error,
      "PAGINATION_FAILED",
      "Unable to paginate the supplied HTML."
    );
  } finally {
    previewer?.polisher?.destroy();
    container.remove();
  }
}
