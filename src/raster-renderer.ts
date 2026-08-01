import html2canvas from "html2canvas";

import type { VectorPage } from "./display-list.js";
import { PagedPdfError, throwIfAborted } from "./errors.js";

const MAX_RASTER_BYTES = 10_000_000;
const MAX_RASTER_PIXELS = 32_000_000;
const MAX_RASTER_SCALE = 2;

interface RasterizedSvg {
  readonly source: string;
  readonly width: number;
  readonly height: number;
  readonly display: string;
  readonly margin: string;
  readonly verticalAlign: string;
}

function pageBounds(element: HTMLElement): DOMRect {
  const pagebox = element.matches(".pagedjs_pagebox")
    ? element
    : (element.querySelector<HTMLElement>(".pagedjs_pagebox") ?? element);
  return pagebox.getBoundingClientRect();
}

function rasterScale(width: number, height: number): number {
  const preferredScale = Math.min(
    Math.max(globalThis.devicePixelRatio || 1, 1),
    MAX_RASTER_SCALE
  );
  const pixelLimitedScale = Math.sqrt(MAX_RASTER_PIXELS / (width * height));
  return Math.min(preferredScale, pixelLimitedScale);
}

function canvasBlob(
  canvas: HTMLCanvasElement,
  type = "image/png",
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) {
        reject(
          new PagedPdfError(
            "DOM_TRANSLATION_FAILED",
            "Unable to encode a rasterized page."
          )
        );
        return;
      }
      if (blob.size > MAX_RASTER_BYTES) {
        reject(
          new PagedPdfError(
            "LIMIT_EXCEEDED",
            "A rasterized page exceeds the 10 MB image limit."
          )
        );
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}

function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener(
      "load",
      () => {
        if (typeof reader.result !== "string") {
          reject(
            new PagedPdfError(
              "DOM_TRANSLATION_FAILED",
              "Unable to read a rasterized page."
            )
          );
          return;
        }
        resolve(reader.result);
      },
      { once: true }
    );
    reader.addEventListener(
      "error",
      () => {
        reject(
          new PagedPdfError(
            "DOM_TRANSLATION_FAILED",
            "Unable to read a rasterized page."
          )
        );
      },
      { once: true }
    );
    reader.readAsDataURL(blob);
  });
}

const SVG_PRESENTATION_PROPERTIES = [
  "color",
  "fill",
  "fill-opacity",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "opacity",
  "stroke",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-opacity",
  "stroke-width"
] as const;

function copyComputedStyles(source: Element, target: Element): void {
  const sourceElements = [source, ...source.querySelectorAll("*")];
  const targetElements = [target, ...target.querySelectorAll("*")];
  for (const [index, sourceElement] of sourceElements.entries()) {
    const targetElement = targetElements[index];
    if (!(targetElement instanceof SVGElement)) continue;
    const style = getComputedStyle(sourceElement);
    for (const property of SVG_PRESENTATION_PROPERTIES) {
      targetElement.style.setProperty(property, style.getPropertyValue(property));
    }
  }
}
function loadSvgImage(svg: SVGElement): Promise<{
  readonly image: HTMLImageElement;
  readonly objectUrl: string;
}> {
  const clone = svg.cloneNode(true) as SVGElement;
  const bounds = svg.getBoundingClientRect();
  copyComputedStyles(svg, clone);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(bounds.width));
  clone.setAttribute("height", String(bounds.height));
  const source = new XMLSerializer().serializeToString(clone);
  const objectUrl = URL.createObjectURL(
    new Blob([source], { type: "image/svg+xml" })
  );

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener(
      "load",
      () => {
        resolve({ image, objectUrl });
      },
      { once: true }
    );
    image.addEventListener(
      "error",
      () => {
        URL.revokeObjectURL(objectUrl);
        reject(
          new PagedPdfError(
            "DOM_TRANSLATION_FAILED",
            "Unable to rasterize an inline SVG."
          )
        );
      },
      { once: true }
    );
    image.src = objectUrl;
  });
}

async function rasterizeSvg(
  svg: SVGElement,
  signal?: AbortSignal
): Promise<RasterizedSvg | undefined> {
  const bounds = svg.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) return undefined;
  const style = getComputedStyle(svg);
  const loaded = await loadSvgImage(svg);
  try {
    throwIfAborted(signal);
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(bounds.width);
    canvas.height = Math.ceil(bounds.height);
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new PagedPdfError(
        "DOM_TRANSLATION_FAILED",
        "Canvas rendering is unavailable for an inline SVG."
      );
    }
    context.drawImage(loaded.image, 0, 0, canvas.width, canvas.height);
    return {
      source: await blobDataUrl(await canvasBlob(canvas)),
      width: bounds.width,
      height: bounds.height,
      display: style.display,
      margin: style.margin,
      verticalAlign: style.verticalAlign
    };
  } finally {
    URL.revokeObjectURL(loaded.objectUrl);
  }
}

async function rasterizeInlineSvgs(
  root: HTMLElement,
  signal?: AbortSignal
): Promise<readonly (RasterizedSvg | undefined)[]> {
  const svgs = [...root.querySelectorAll<SVGElement>("svg")];
  return await Promise.all(
    svgs.map(async (svg) => await rasterizeSvg(svg, signal))
  );
}

function replaceClonedSvgs(
  clonedRoot: HTMLElement,
  rasterizedSvgs: readonly (RasterizedSvg | undefined)[]
): void {
  const clonedSvgs = [...clonedRoot.querySelectorAll<SVGElement>("svg")];
  for (const [index, svg] of clonedSvgs.entries()) {
    const rasterized = rasterizedSvgs[index];
    if (rasterized === undefined) continue;
    const image = clonedRoot.ownerDocument.createElement("img");
    image.src = rasterized.source;
    image.alt = svg.getAttribute("aria-label") ?? "";
    image.style.width = String(rasterized.width) + "px";
    image.style.height = String(rasterized.height) + "px";
    image.style.display = rasterized.display;
    image.style.margin = rasterized.margin;
    image.style.verticalAlign = rasterized.verticalAlign;
    svg.replaceWith(image);
  }
}

export async function buildRasterPage(
  root: HTMLElement,
  signal?: AbortSignal
): Promise<VectorPage> {
  throwIfAborted(signal);
  const bounds = pageBounds(root);
  if (
    !Number.isFinite(bounds.width) ||
    bounds.width <= 0 ||
    !Number.isFinite(bounds.height) ||
    bounds.height <= 0
  ) {
    throw new PagedPdfError(
      "INVALID_PAGE_SIZE",
      "A Paged.js page has no measurable width or height."
    );
  }

  const scale = rasterScale(bounds.width, bounds.height);
  const rasterizedSvgs = await rasterizeInlineSvgs(root, signal);
  throwIfAborted(signal);
  const canvas = await html2canvas(root, {
    allowTaint: false,
    backgroundColor: "#ffffff",
    logging: false,
    onclone: (_document, clonedRoot) => {
      replaceClonedSvgs(clonedRoot, rasterizedSvgs);
    },
    scale,
    useCORS: false,
    width: bounds.width,
    height: bounds.height
  });
  throwIfAborted(signal);
  const source = await blobDataUrl(
    await canvasBlob(canvas, "image/jpeg", 0.96)
  );
  throwIfAborted(signal);

  return {
    widthCssPixels: bounds.width,
    heightCssPixels: bounds.height,
    commands: [
      {
        kind: "image",
        source,
        x: 0,
        y: 0,
        width: bounds.width,
        height: bounds.height
      }
    ]
  };
}