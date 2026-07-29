import { PagedPdfError, throwIfAborted } from "./errors.js";

const MAX_IMAGE_BYTES = 10_000_000;
const MAX_IMAGE_DIMENSION = 10_000;
const MAX_IMAGE_PIXELS = 40_000_000;

export type SupportedImageFormat = "JPEG" | "PNG";

export interface LoadedImageResource {
  readonly bytes: Uint8Array;
  readonly format: SupportedImageFormat;
  readonly width: number;
  readonly height: number;
}

function imageError(message: string): PagedPdfError {
  return new PagedPdfError("IMAGE_ERROR", message);
}

function byteAt(bytes: Uint8Array, index: number): number {
  return bytes[index] ?? 0;
}

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

function decodeDataUrl(source: string): Uint8Array {
  const separator = source.indexOf(",");
  if (
    separator < 0 ||
    !source.slice(0, separator).toLowerCase().includes(";base64")
  ) {
    throw imageError("Images must use base64 data URLs.");
  }
  const encoded = source.slice(separator + 1).replaceAll(/\s+/gu, "");
  const estimatedBytes = Math.floor((encoded.length * 3) / 4);
  if (estimatedBytes > MAX_IMAGE_BYTES) {
    throw new PagedPdfError("LIMIT_EXCEEDED", "An image exceeds the 10 MB limit.");
  }
  try {
    const binary = atob(encoded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch (error) {
    throw new PagedPdfError("IMAGE_ERROR", "An image has invalid base64 data.", {
      cause: error
    });
  }
}

function pngDimensions(bytes: Uint8Array): readonly [number, number] | undefined {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (
    bytes.length < 24 ||
    !signature.every((value, index) => bytes[index] === value)
  ) {
    return undefined;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return [view.getUint32(16), view.getUint32(20)];
}

function isStartOfFrame(marker: number): boolean {
  return [
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
    0xcf
  ].includes(marker);
}

function jpegDimensions(bytes: Uint8Array): readonly [number, number] | undefined {
  if (
    bytes.length < 4 ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8 ||
    bytes[2] !== 0xff
  ) {
    return undefined;
  }
  let offset = 2;
  while (offset + 8 < bytes.length) {
    while (byteAt(bytes, offset) === 0xff) {
      offset += 1;
    }
    const marker = bytes[offset];
    offset += 1;
    if (marker === undefined || marker === 0xd9 || marker === 0xda) {
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    if (offset + 1 >= bytes.length) {
      break;
    }
    const segmentLength =
      (byteAt(bytes, offset) << 8) | byteAt(bytes, offset + 1);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      break;
    }
    if (isStartOfFrame(marker) && segmentLength >= 7) {
      const height =
        (byteAt(bytes, offset + 3) << 8) | byteAt(bytes, offset + 4);
      const width =
        (byteAt(bytes, offset + 5) << 8) | byteAt(bytes, offset + 6);
      return [width, height];
    }
    offset += segmentLength;
  }
  return undefined;
}

function validateDimensions(width: number, height: number): void {
  if (
    width <= 0 ||
    height <= 0 ||
    width > MAX_IMAGE_DIMENSION ||
    height > MAX_IMAGE_DIMENSION ||
    width * height > MAX_IMAGE_PIXELS
  ) {
    throw new PagedPdfError(
      "LIMIT_EXCEEDED",
      "An image exceeds the supported dimension or 40 megapixel limit."
    );
  }
}

function inspectImage(bytes: Uint8Array): LoadedImageResource {
  const png = pngDimensions(bytes);
  if (png !== undefined) {
    validateDimensions(png[0], png[1]);
    return { bytes, format: "PNG", width: png[0], height: png[1] };
  }
  const jpeg = jpegDimensions(bytes);
  if (jpeg !== undefined) {
    validateDimensions(jpeg[0], jpeg[1]);
    return { bytes, format: "JPEG", width: jpeg[0], height: jpeg[1] };
  }
  throw imageError("Only valid PNG and JPEG image bytes are supported.");
}

async function readBoundedResponse(
  response: Response,
  signal?: AbortSignal
): Promise<Uint8Array> {
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_IMAGE_BYTES) {
    throw new PagedPdfError("LIMIT_EXCEEDED", "An image exceeds the 10 MB limit.");
  }
  if (response.body === null) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      throw new PagedPdfError(
        "LIMIT_EXCEEDED",
        "An image exceeds the 10 MB limit."
      );
    }
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      throwIfAborted(signal);
      const result = await reader.read();
      if (result.done) {
        break;
      }
      totalBytes += result.value.byteLength;
      if (totalBytes > MAX_IMAGE_BYTES) {
        await reader.cancel();
        throw new PagedPdfError(
          "LIMIT_EXCEEDED",
          "An image exceeds the 10 MB limit."
        );
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function loadImageResource(
  source: string,
  signal?: AbortSignal
): Promise<LoadedImageResource> {
  throwIfAborted(signal);
  if (source.startsWith("data:")) {
    return inspectImage(decodeDataUrl(source));
  }

  try {
    const response = await fetch(source, {
      credentials: "same-origin",
      redirect: "error",
      signal
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return inspectImage(await readBoundedResponse(response, signal));
  } catch (error) {
    if (error instanceof PagedPdfError) {
      throw error;
    }
    throw new PagedPdfError(
      "IMAGE_ERROR",
      `Unable to load image resource: ${displayUrl(source)}`,
      { cause: error }
    );
  }
}
