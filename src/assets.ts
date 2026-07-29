import {
  PagedPdfError,
  throwIfAborted,
  waitWithAbort
} from "./errors.js";

function displayUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return value.split(/[?#]/u, 1)[0] ?? "";
  }
}

async function waitForImage(
  image: HTMLImageElement,
  signal?: AbortSignal
): Promise<void> {
  throwIfAborted(signal);

  if (image.complete && image.naturalWidth > 0) {
    return;
  }

  try {
    await waitWithAbort(image.decode(), signal);
  } catch (error) {
    if (error instanceof PagedPdfError && error.code === "ABORTED") {
      throw error;
    }
    const source = image.currentSrc || image.src;
    throw new PagedPdfError(
      "ASSET_ERROR",
      `Unable to load image${source ? `: ${displayUrl(source)}` : "."}`,
      { cause: error }
    );
  }
}

export async function waitForAssets(
  root: ParentNode,
  signal?: AbortSignal
): Promise<void> {
  throwIfAborted(signal);

  const rootDocument =
    root instanceof Document
      ? root
      : (root.ownerDocument ?? document);
  const fontsReady =
    "fonts" in rootDocument
      ? rootDocument.fonts.ready.then(() => undefined)
      : undefined;
  const imagesReady = Array.from(
    root.querySelectorAll<HTMLImageElement>("img")
  ).map((image) => waitForImage(image, signal));

  await waitWithAbort(
    Promise.all([fontsReady, ...imagesReady]).then(() => undefined),
    signal
  );
}
