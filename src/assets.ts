import {
  PagedPdfError,
  throwIfAborted,
  waitWithAbort
} from "./errors.js";

const MAX_IMAGE_COUNT = 100;
const IMAGE_DECODE_CONCURRENCY = 4;

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

async function waitForImages(
  images: readonly HTMLImageElement[],
  signal?: AbortSignal
): Promise<void> {
  if (images.length > MAX_IMAGE_COUNT) {
    throw new PagedPdfError(
      "LIMIT_EXCEEDED",
      `Paged output exceeds the ${MAX_IMAGE_COUNT} image limit.`
    );
  }
  let nextIndex = 0;
  const decodeNext = async (): Promise<void> => {
    while (nextIndex < images.length) {
      const image = images[nextIndex];
      nextIndex += 1;
      if (image !== undefined) {
        await waitForImage(image, signal);
      }
    }
  };
  const workerCount = Math.min(IMAGE_DECODE_CONCURRENCY, images.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => await decodeNext())
  );
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
      : Promise.resolve();
  const images = Array.from(
    root.querySelectorAll<HTMLImageElement>("img")
  );

  await waitWithAbort(
    Promise.all([fontsReady, waitForImages(images, signal)]).then(
      () => undefined
    ),
    signal
  );
}
