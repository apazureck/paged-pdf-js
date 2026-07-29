import { PagedPdfError, throwIfAborted } from "./errors.js";
import { loadImageResource } from "./image-loader.js";

const MAX_IMAGE_COUNT = 100;
const MAX_TOTAL_IMAGE_BYTES = 40_000_000;
const IMAGE_LOAD_CONCURRENCY = 4;
const CSS_RESOURCE_URL = /url\s*\(/iu;
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const PASSIVE_RESOURCE_ATTRIBUTES = new Set([
  "background",
  "poster",
  "src",
  "srcset"
]);

function imageMimeType(format: "JPEG" | "PNG"): string {
  return format === "PNG" ? "image/png" : "image/jpeg";
}

export function assertNoCssResourceUrls(styleText: string): void {
  if (CSS_RESOURCE_URL.test(styleText)) {
    throw new PagedPdfError(
      "INVALID_INPUT",
      "CSS resource URLs are not supported by the primitive PDF renderer."
    );
  }
}

function removeUnusedResourceAttributes(fragment: DocumentFragment): void {
  for (const element of fragment.querySelectorAll("*")) {
    const isImage = element instanceof HTMLImageElement;
    for (const attribute of Array.from(element.attributes)) {
      const attributeName = attribute.name.toLowerCase();
      if (
        CSS_RESOURCE_URL.test(attribute.value) ||
        (!isImage && PASSIVE_RESOURCE_ATTRIBUTES.has(attributeName)) ||
        (element.namespaceURI === SVG_NAMESPACE &&
          ["href", "src", "xlink:href"].includes(attributeName))
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  }
}

export async function materializeImageResources(
  fragment: DocumentFragment,
  signal?: AbortSignal
): Promise<() => undefined> {
  removeUnusedResourceAttributes(fragment);
  const images = Array.from(fragment.querySelectorAll<HTMLImageElement>("img"));
  if (images.length > MAX_IMAGE_COUNT) {
    throw new PagedPdfError(
      "LIMIT_EXCEEDED",
      `HTML input exceeds the ${MAX_IMAGE_COUNT} image limit.`
    );
  }

  const objectUrls: string[] = [];
  let nextIndex = 0;
  let totalBytes = 0;
  const loadNext = async (): Promise<void> => {
    while (nextIndex < images.length) {
      throwIfAborted(signal);
      const image = images[nextIndex];
      nextIndex += 1;
      if (image === undefined) {
        continue;
      }
      image.removeAttribute("srcset");
      const source = image.getAttribute("src");
      if (source === null || source.length === 0) {
        continue;
      }
      const loaded = await loadImageResource(source, signal);
      totalBytes += loaded.bytes.byteLength;
      if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
        throw new PagedPdfError(
          "LIMIT_EXCEEDED",
          "Images exceed the 40 MB aggregate input limit."
        );
      }
      const stableBytes = Uint8Array.from(loaded.bytes);
      const objectUrl = URL.createObjectURL(
        new Blob([stableBytes.buffer], { type: imageMimeType(loaded.format) })
      );
      objectUrls.push(objectUrl);
      image.src = objectUrl;
    }
  };

  try {
    const workerCount = Math.min(IMAGE_LOAD_CONCURRENCY, images.length);
    await Promise.all(
      Array.from({ length: workerCount }, async () => await loadNext())
    );
  } catch (error) {
    for (const objectUrl of objectUrls) {
      URL.revokeObjectURL(objectUrl);
    }
    throw error;
  }

  return () => {
    for (const objectUrl of objectUrls) {
      URL.revokeObjectURL(objectUrl);
    }
    return undefined;
  };
}
