import { jsPDF } from "jspdf";

import type {
  DrawCommand,
  ImageCommand,
  PdfColor,
  VectorPage
} from "./display-list.js";
import { PagedPdfError, toPagedPdfError, throwIfAborted } from "./errors.js";
import { cssLengthToPoints, cssPixelsToPoints } from "./geometry.js";
import {
  loadImageResource,
  type LoadedImageResource
} from "./image-loader.js";
import type { PdfMetadata } from "./types.js";

const MAX_DOCUMENT_COMMANDS = 100_000;
const MAX_IMAGE_COUNT = 100;
const MAX_TOTAL_IMAGE_BYTES = 40_000_000;

export interface PdfWriterOptions extends PdfMetadata {
  readonly signal?: AbortSignal;
  readonly onPageWritten?: (page: number) => void;
}

interface ImageCache {
  readonly resources: Map<string, Promise<LoadedImageResource>>;
  totalBytes: number;
}

function pageOrientation(page: VectorPage): "landscape" | "portrait" {
  return page.widthCssPixels > page.heightCssPixels
    ? "landscape"
    : "portrait";
}

function pageFormat(page: VectorPage): [number, number] {
  return [
    cssPixelsToPoints(page.widthCssPixels),
    cssPixelsToPoints(page.heightCssPixels)
  ];
}

function setColor(
  setColor: (red: number, green: number, blue: number) => unknown,
  color: PdfColor
): void {
  setColor(color[0], color[1], color[2]);
}

function cachedImage(
  command: ImageCommand,
  signal: AbortSignal | undefined,
  imageCache: ImageCache
): Promise<LoadedImageResource> {
  const existing = imageCache.resources.get(command.source);
  if (existing !== undefined) {
    return existing;
  }
  if (imageCache.resources.size >= MAX_IMAGE_COUNT) {
    throw new PagedPdfError(
      "LIMIT_EXCEEDED",
      `A document exceeds the ${MAX_IMAGE_COUNT} unique image limit.`
    );
  }
  const pending = loadImageResource(command.source, signal).then((resource) => {
    imageCache.totalBytes += resource.bytes.byteLength;
    if (imageCache.totalBytes > MAX_TOTAL_IMAGE_BYTES) {
      throw new PagedPdfError(
        "LIMIT_EXCEEDED",
        "Images exceed the 40 MB aggregate input limit."
      );
    }
    return resource;
  });
  imageCache.resources.set(command.source, pending);
  return pending;
}

async function drawImage(
  document: jsPDF,
  command: ImageCommand,
  signal: AbortSignal | undefined,
  imageCache: ImageCache
): Promise<void> {
  const resource = await cachedImage(command, signal, imageCache);
  throwIfAborted(signal);
  document.addImage(
    resource.bytes,
    resource.format,
    cssPixelsToPoints(command.x),
    cssPixelsToPoints(command.y),
    cssPixelsToPoints(command.width),
    cssPixelsToPoints(command.height),
    command.source,
    "FAST"
  );
}

async function drawCommand(
  document: jsPDF,
  command: DrawCommand,
  options: PdfWriterOptions,
  imageCache: ImageCache
): Promise<void> {
  throwIfAborted(options.signal);
  if (command.kind === "fill") {
    setColor(document.setFillColor.bind(document), command.color);
    document.rect(
      cssPixelsToPoints(command.x),
      cssPixelsToPoints(command.y),
      cssPixelsToPoints(command.width),
      cssPixelsToPoints(command.height),
      "F"
    );
    return;
  }
  if (command.kind === "text") {
    document.setFont(command.fontFamily, command.fontStyle);
    document.setFontSize(cssPixelsToPoints(command.fontSize));
    setColor(document.setTextColor.bind(document), command.color);
    document.text(
      command.text,
      cssPixelsToPoints(command.x),
      cssPixelsToPoints(command.y),
      {
        baseline: "top",
        charSpace: cssLengthToPoints(command.letterSpacing)
      }
    );
    return;
  }
  if (command.kind === "image") {
    await drawImage(document, command, options.signal, imageCache);
    return;
  }
  document.link(
    cssPixelsToPoints(command.x),
    cssPixelsToPoints(command.y),
    cssPixelsToPoints(command.width),
    cssPixelsToPoints(command.height),
    { url: command.url }
  );
}

function setMetadata(document: jsPDF, metadata: PdfMetadata): void {
  document.setDocumentProperties({
    title: metadata.title ?? "",
    author: metadata.author ?? "",
    subject: metadata.subject ?? "",
    keywords: metadata.keywords?.join(", ") ?? "",
    creator: "paged-pdf-js"
  });
}

export async function writeVectorPdf(
  pages: readonly VectorPage[],
  options: PdfWriterOptions = {}
): Promise<Uint8Array> {
  try {
    throwIfAborted(options.signal);
    const firstPage = pages[0];
    if (firstPage === undefined) {
      throw new Error("At least one vector page is required.");
    }
    const commandCount = pages.reduce(
      (total, page) => total + page.commands.length,
      0
    );
    if (commandCount > MAX_DOCUMENT_COMMANDS) {
      throw new PagedPdfError(
        "LIMIT_EXCEEDED",
        `A document exceeds the ${MAX_DOCUMENT_COMMANDS.toLocaleString()} drawing command limit.`
      );
    }

    const document = new jsPDF({
      unit: "pt",
      format: pageFormat(firstPage),
      orientation: pageOrientation(firstPage),
      compress: true,
      putOnlyUsedFonts: true
    });
    setMetadata(document, options);
    const imageCache: ImageCache = {
      resources: new Map<string, Promise<LoadedImageResource>>(),
      totalBytes: 0
    };

    for (const [pageIndex, page] of pages.entries()) {
      throwIfAborted(options.signal);
      if (pageIndex > 0) {
        document.addPage(pageFormat(page), pageOrientation(page));
      }
      for (const command of page.commands) {
        await drawCommand(document, command, options, imageCache);
      }
      options.onPageWritten?.(pageIndex + 1);
    }

    return new Uint8Array(document.output("arraybuffer"));
  } catch (error) {
    throw toPagedPdfError(
      error,
      "PDF_WRITE_FAILED",
      "Unable to write the PDF document."
    );
  }
}
