import { PagedPdfError } from "./errors.js";

export function downloadPdf(
  pdf: Uint8Array | Blob,
  filename = "document.pdf"
): void {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    throw new PagedPdfError(
      "BROWSER_REQUIRED",
      "Downloading a PDF requires a browser DOM."
    );
  }

  const safeFilename = filename.toLowerCase().endsWith(".pdf")
    ? filename
    : `${filename}.pdf`;
  const stableBytes =
    pdf instanceof Blob ? pdf : new Uint8Array(pdf);
  const blob =
    stableBytes instanceof Blob
      ? stableBytes
      : new Blob([stableBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeFilename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}
