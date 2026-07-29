import { PDFDocument } from "pdf-lib";

import { toPagedPdfError, throwIfAborted } from "./errors.js";
import { cssPixelsToPoints } from "./geometry.js";
import type { PdfMetadata } from "./types.js";

export interface RasterPage {
  readonly dataUrl: string;
  readonly widthCssPixels: number;
  readonly heightCssPixels: number;
  readonly format?: "png" | "jpeg";
}

export interface PdfWriterOptions extends PdfMetadata {
  readonly signal?: AbortSignal;
  readonly onPageWritten?: (page: number) => void;
}

type RasterPages = Iterable<RasterPage> | AsyncIterable<RasterPage>;

function setMetadata(document: PDFDocument, metadata: PdfMetadata): void {
  if (metadata.title !== undefined) {
    document.setTitle(metadata.title);
  }
  if (metadata.author !== undefined) {
    document.setAuthor(metadata.author);
  }
  if (metadata.subject !== undefined) {
    document.setSubject(metadata.subject);
  }
  if (metadata.keywords !== undefined) {
    document.setKeywords([...metadata.keywords]);
  }
  document.setCreator("paged-pdf-js");
  document.setProducer("paged-pdf-js");
}

export async function writeRasterPdf(
  pages: RasterPages,
  options: PdfWriterOptions = {}
): Promise<Uint8Array> {
  try {
    throwIfAborted(options.signal);
    const document = await PDFDocument.create();
    setMetadata(document, options);
    let pageNumber = 0;

    for await (const rasterPage of pages) {
      throwIfAborted(options.signal);
      const width = cssPixelsToPoints(rasterPage.widthCssPixels);
      const height = cssPixelsToPoints(rasterPage.heightCssPixels);
      const image =
        rasterPage.format === "jpeg" ||
        rasterPage.dataUrl.startsWith("data:image/jpeg")
          ? await document.embedJpg(rasterPage.dataUrl)
          : await document.embedPng(rasterPage.dataUrl);
      const pdfPage = document.addPage([width, height]);
      pdfPage.drawImage(image, { x: 0, y: 0, width, height });
      pageNumber += 1;
      options.onPageWritten?.(pageNumber);
    }

    return await document.save();
  } catch (error) {
    throw toPagedPdfError(
      error,
      "PDF_WRITE_FAILED",
      "Unable to write the PDF document."
    );
  }
}
