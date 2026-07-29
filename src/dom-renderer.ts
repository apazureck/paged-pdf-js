import { parseCssColor } from "./css-color.js";
import type {
  DrawCommand,
  ImageCommand,
  PdfFontFamily,
  PdfFontStyle,
  VectorPage
} from "./display-list.js";
import { PagedPdfError, throwIfAborted } from "./errors.js";

const MAX_COMMANDS_PER_PAGE = 25_000;
const MAX_ELEMENTS_PER_PAGE = 20_000;
const MAX_PAGE_DIMENSION_CSS_PIXELS = 20_000;
const MAX_PAGE_AREA_CSS_PIXELS = 100_000_000;
const MAX_TEXT_CHARACTERS_PER_PAGE = 1_000_000;
const MAX_TEXT_RANGE_OPERATIONS = 50_000;
const YIELD_INTERVAL = 250;
const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
const SKIPPED_TEXT_ANCESTORS = "script,style,svg,template";

interface Rectangle {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

interface TextBudget {
  characters: number;
  rangeOperations: number;
}

class CommandCollector {
  readonly commands: DrawCommand[] = [];

  add(command: DrawCommand): void {
    if (this.commands.length >= MAX_COMMANDS_PER_PAGE) {
      throw new PagedPdfError(
        "LIMIT_EXCEEDED",
        `A page exceeds the ${MAX_COMMANDS_PER_PAGE.toLocaleString()} drawing command limit.`
      );
    }
    this.commands.push(command);
  }

  addAll(commands: readonly DrawCommand[]): void {
    for (const command of commands) {
      this.add(command);
    }
  }
}

async function yieldForAbort(signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  throwIfAborted(signal);
}

async function consumeTextOperation(
  budget: TextBudget,
  signal?: AbortSignal
): Promise<void> {
  budget.rangeOperations += 1;
  if (budget.rangeOperations > MAX_TEXT_RANGE_OPERATIONS) {
    throw new PagedPdfError(
      "LIMIT_EXCEEDED",
      `A page exceeds the ${MAX_TEXT_RANGE_OPERATIONS.toLocaleString()} text layout operation limit.`
    );
  }
  if (budget.rangeOperations % YIELD_INTERVAL === 0) {
    await yieldForAbort(signal);
  } else {
    throwIfAborted(signal);
  }
}

function measurePage(element: HTMLElement): Rectangle {
  const bounds = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const width =
    bounds.width || element.offsetWidth || Number.parseFloat(style.width);
  const height =
    bounds.height || element.offsetHeight || Number.parseFloat(style.height);
  if (
    !Number.isFinite(width) ||
    width <= 0 ||
    !Number.isFinite(height) ||
    height <= 0
  ) {
    throw new PagedPdfError(
      "INVALID_PAGE_SIZE",
      "A Paged.js page has no measurable width or height."
    );
  }
  if (
    width > MAX_PAGE_DIMENSION_CSS_PIXELS ||
    height > MAX_PAGE_DIMENSION_CSS_PIXELS ||
    width * height > MAX_PAGE_AREA_CSS_PIXELS
  ) {
    throw new PagedPdfError(
      "LIMIT_EXCEEDED",
      "A Paged.js page exceeds the supported dimensions or area."
    );
  }
  return { left: bounds.left, top: bounds.top, width, height };
}

function isVisible(element: Element): boolean {
  if (!(element instanceof HTMLElement || element instanceof SVGElement)) {
    return false;
  }
  const style = getComputedStyle(element);
  return (
    !element.hasAttribute("hidden") &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    Number.parseFloat(style.opacity || "1") > 0
  );
}

function clientRectangles(element: Element): readonly DOMRect[] {
  const rectangles = Array.from(element.getClientRects()).filter(
    (rectangle) => rectangle.width > 0 && rectangle.height > 0
  );
  if (rectangles.length > 0) {
    return rectangles;
  }
  const bounds = element.getBoundingClientRect();
  return bounds.width > 0 && bounds.height > 0 ? [bounds] : [];
}

function relativeRectangle(
  rectangle: Rectangle,
  page: Rectangle
): Rectangle | undefined {
  const left = Math.max(rectangle.left, page.left);
  const top = Math.max(rectangle.top, page.top);
  const right = Math.min(rectangle.left + rectangle.width, page.left + page.width);
  const bottom = Math.min(
    rectangle.top + rectangle.height,
    page.top + page.height
  );
  if (right <= left || bottom <= top) {
    return undefined;
  }
  return {
    left: left - page.left,
    top: top - page.top,
    width: right - left,
    height: bottom - top
  };
}

function fontFamily(style: CSSStyleDeclaration): PdfFontFamily {
  const family = style.fontFamily.toLowerCase();
  if (
    family.includes("monospace") ||
    family.includes("courier") ||
    family.includes("consolas")
  ) {
    return "courier";
  }
  if (family.includes("serif") && !family.includes("sans-serif")) {
    return "times";
  }
  return "helvetica";
}

function fontStyle(style: CSSStyleDeclaration): PdfFontStyle {
  const weight = Number.parseInt(style.fontWeight, 10);
  const bold = Number.isFinite(weight)
    ? weight >= 600
    : style.fontWeight === "bold" || style.fontWeight === "bolder";
  const italic =
    style.fontStyle === "italic" || style.fontStyle === "oblique";
  if (bold && italic) {
    return "bolditalic";
  }
  if (bold) {
    return "bold";
  }
  return italic ? "italic" : "normal";
}

function transformedText(text: string, transform: string): string {
  if (transform === "uppercase") {
    return text.toUpperCase();
  }
  if (transform === "lowercase") {
    return text.toLowerCase();
  }
  if (transform === "capitalize") {
    return text.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
  }
  return text;
}

function backgroundCommands(
  element: Element,
  page: Rectangle
): readonly DrawCommand[] {
  const color = parseCssColor(getComputedStyle(element).backgroundColor);
  if (color === undefined) {
    return [];
  }
  return clientRectangles(element).flatMap((rectangle) => {
    const relative = relativeRectangle(rectangle, page);
    return relative === undefined
      ? []
      : [{
          kind: "fill" as const,
          x: relative.left,
          y: relative.top,
          width: relative.width,
          height: relative.height,
          color
        }];
  });
}

function borderCommands(
  element: Element,
  page: Rectangle
): readonly DrawCommand[] {
  const style = getComputedStyle(element);
  const bounds = relativeRectangle(element.getBoundingClientRect(), page);
  if (bounds === undefined) {
    return [];
  }
  const sides = [
    {
      style: style.borderTopStyle,
      width: Number.parseFloat(style.borderTopWidth),
      color: parseCssColor(style.borderTopColor),
      x: bounds.left,
      y: bounds.top,
      boxWidth: bounds.width,
      boxHeight: Number.parseFloat(style.borderTopWidth)
    },
    {
      style: style.borderRightStyle,
      width: Number.parseFloat(style.borderRightWidth),
      color: parseCssColor(style.borderRightColor),
      x: bounds.left + bounds.width - Number.parseFloat(style.borderRightWidth),
      y: bounds.top,
      boxWidth: Number.parseFloat(style.borderRightWidth),
      boxHeight: bounds.height
    },
    {
      style: style.borderBottomStyle,
      width: Number.parseFloat(style.borderBottomWidth),
      color: parseCssColor(style.borderBottomColor),
      x: bounds.left,
      y: bounds.top + bounds.height - Number.parseFloat(style.borderBottomWidth),
      boxWidth: bounds.width,
      boxHeight: Number.parseFloat(style.borderBottomWidth)
    },
    {
      style: style.borderLeftStyle,
      width: Number.parseFloat(style.borderLeftWidth),
      color: parseCssColor(style.borderLeftColor),
      x: bounds.left,
      y: bounds.top,
      boxWidth: Number.parseFloat(style.borderLeftWidth),
      boxHeight: bounds.height
    }
  ] as const;
  return sides.flatMap((side) =>
    side.style !== "solid" ||
    !Number.isFinite(side.width) ||
    side.width <= 0 ||
    side.color === undefined
      ? []
      : [{
          kind: "fill" as const,
          x: side.x,
          y: side.y,
          width: side.boxWidth,
          height: side.boxHeight,
          color: side.color
        }]
  );
}

function imageCommand(
  image: HTMLImageElement,
  page: Rectangle
): ImageCommand | undefined {
  const source = image.currentSrc || image.src;
  const bounds = relativeRectangle(image.getBoundingClientRect(), page);
  if (source.length === 0 || bounds === undefined) {
    return undefined;
  }
  return {
    kind: "image",
    source,
    x: bounds.left,
    y: bounds.top,
    width: bounds.width,
    height: bounds.height
  };
}

async function addTextCommands(
  root: HTMLElement,
  page: Rectangle,
  collector: CommandCollector,
  signal?: AbortSignal
): Promise<void> {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const budget: TextBudget = { characters: 0, rangeOperations: 0 };
  let node = walker.nextNode();
  let visited = 0;
  while (node !== null) {
    visited += 1;
    if (visited % YIELD_INTERVAL === 0) {
      await yieldForAbort(signal);
    }
    const textNode = node as Text;
    budget.characters += textNode.data.length;
    if (budget.characters > MAX_TEXT_CHARACTERS_PER_PAGE) {
      throw new PagedPdfError(
        "LIMIT_EXCEEDED",
        `A page exceeds the ${MAX_TEXT_CHARACTERS_PER_PAGE.toLocaleString()} text character limit.`
      );
    }
    const parent = textNode.parentElement;
    if (
      parent !== null &&
      parent.closest(SKIPPED_TEXT_ANCESTORS) === null &&
      isVisible(parent)
    ) {
      const style = getComputedStyle(parent);
      const color = parseCssColor(style.color) ?? [0, 0, 0];
      for (const match of textNode.data.matchAll(/\S+(?:\s+|$)/gu)) {
        await consumeTextOperation(budget, signal);
        const text = match[0];
        const start = match.index;
        const range = document.createRange();
        range.setStart(textNode, start);
        range.setEnd(textNode, start + text.length);
        const rectangles = Array.from(range.getClientRects());
        range.detach();
        for (const rectangle of rectangles) {
          await consumeTextOperation(budget, signal);
          const relative = relativeRectangle(rectangle, page);
          if (relative !== undefined) {
            collector.add({
              kind: "text",
              text: transformedText(text, style.textTransform),
              x: relative.left,
              y: relative.top,
              fontFamily: fontFamily(style),
              fontStyle: fontStyle(style),
              fontSize: Number.parseFloat(style.fontSize) || 16,
              color
            });
          }
        }
      }
    }
    node = walker.nextNode();
  }
}

function safeLinkUrl(anchor: HTMLAnchorElement): string | undefined {
  try {
    const url = new URL(anchor.href, document.location.href);
    return SAFE_LINK_PROTOCOLS.has(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function addLinkCommands(
  root: HTMLElement,
  page: Rectangle,
  collector: CommandCollector
): void {
  for (const anchor of root.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    const url = safeLinkUrl(anchor);
    if (url === undefined || !isVisible(anchor)) {
      continue;
    }
    for (const rectangle of clientRectangles(anchor)) {
      const relative = relativeRectangle(rectangle, page);
      if (relative !== undefined) {
        collector.add({
          kind: "link",
          x: relative.left,
          y: relative.top,
          width: relative.width,
          height: relative.height,
          url
        });
      }
    }
  }
}

export async function buildVectorPage(
  root: HTMLElement,
  signal?: AbortSignal
): Promise<VectorPage> {
  throwIfAborted(signal);
  const page = measurePage(root);
  const elements = root.querySelectorAll("*");
  if (elements.length > MAX_ELEMENTS_PER_PAGE) {
    throw new PagedPdfError(
      "LIMIT_EXCEEDED",
      `A page exceeds the ${MAX_ELEMENTS_PER_PAGE.toLocaleString()} element limit.`
    );
  }

  const collector = new CommandCollector();
  collector.addAll(backgroundCommands(root, page));
  collector.addAll(borderCommands(root, page));
  for (const [index, element] of Array.from(elements).entries()) {
    if (index > 0 && index % YIELD_INTERVAL === 0) {
      await yieldForAbort(signal);
    }
    if (!isVisible(element)) {
      continue;
    }
    collector.addAll(backgroundCommands(element, page));
    collector.addAll(borderCommands(element, page));
    if (element instanceof HTMLImageElement) {
      const command = imageCommand(element, page);
      if (command !== undefined) {
        collector.add(command);
      }
    }
  }
  await addTextCommands(root, page, collector, signal);
  addLinkCommands(root, page, collector);
  throwIfAborted(signal);

  return {
    widthCssPixels: page.width,
    heightCssPixels: page.height,
    commands: Object.freeze([...collector.commands])
  };
}
