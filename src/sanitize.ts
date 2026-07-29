import { generate, parse, walk } from "css-tree";

import { PagedPdfError } from "./errors.js";

const BLOCKED_ELEMENTS = [
  "base",
  "embed",
  "iframe",
  "link",
  "meta",
  "object",
  "script",
  "style",
  "template"
].join(",");
const BLOCKED_SVG_ELEMENTS = new Set([
  "animate",
  "animatemotion",
  "animatetransform",
  "discard",
  "set"
]);
const SVG_CSS_URL_ATTRIBUTES = new Set([
  "clip-path",
  "cursor",
  "fill",
  "filter",
  "marker",
  "marker-end",
  "marker-mid",
  "marker-start",
  "mask",
  "stroke"
]);
const MAX_INPUT_CHARACTERS = 2_500_000;
const MAX_DOM_ELEMENTS = 50_000;

const NAVIGATION_URL_ATTRIBUTES = new Set([
  "action",
  "formaction",
  "href"
]);
const RESOURCE_URL_ATTRIBUTES = new Set([
  "poster",
  "src",
  "xlink:href"
]);
const SVG_RESOURCE_HREF_ELEMENTS = new Set(["feimage", "image", "use"]);
const URL_STRING_FUNCTIONS = new Set([
  "-webkit-image-set",
  "image",
  "image-set"
]);
const SAFE_DATA_IMAGE = /^data:image\/(?:gif|jpeg|png|webp);/iu;

export interface ResourcePolicy {
  readonly baseUrl?: string;
  readonly allowedResourceOrigins?: readonly string[];
}

function compactUrl(value: string): string {
  return value.replaceAll(/[\u0000-\u0020]+/g, "");
}

function decodeCssIdentifier(value: string): string {
  return value.replace(
    /\\(?:([0-9a-f]{1,6})[ \t\r\n\f]?|([^\r\n\f0-9a-f]))/giu,
    (_match, hex: string | undefined, escaped: string | undefined) => {
      if (hex === undefined) {
        return escaped ?? "";
      }
      const codePoint = Number.parseInt(hex, 16);
      if (
        codePoint === 0 ||
        codePoint > 0x10ffff ||
        (codePoint >= 0xd800 && codePoint <= 0xdfff)
      ) {
        return "\uFFFD";
      }
      return String.fromCodePoint(codePoint);
    }
  );
}

function isActiveUrl(value: string): boolean {
  const compactValue = compactUrl(value).toLowerCase();
  return (
    compactValue.startsWith("javascript:") ||
    compactValue.startsWith("vbscript:")
  );
}

function resolveUrl(value: string, baseUrl?: string): string | undefined {
  if (value.startsWith("#")) {
    return value;
  }

  try {
    return new URL(value, baseUrl ?? document.location.href).href;
  } catch {
    return undefined;
  }
}

function allowedOrigins(policy: ResourcePolicy): ReadonlySet<string> {
  const origins = new Set<string>([document.location.origin]);
  for (const origin of policy.allowedResourceOrigins ?? []) {
    try {
      origins.add(new URL(origin).origin);
    } catch {
      throw new PagedPdfError(
        "INVALID_OPTION",
        `Invalid allowed resource origin: ${origin}`
      );
    }
  }
  return origins;
}

function resolveResourceUrl(
  value: string,
  policy: ResourcePolicy
): string | undefined {
  const compactValue = compactUrl(value);
  if (SAFE_DATA_IMAGE.test(compactValue)) {
    return compactValue;
  }
  if (compactValue.toLowerCase().startsWith("data:")) {
    return undefined;
  }

  const resolved = resolveUrl(compactValue, policy.baseUrl);
  if (resolved === undefined || isActiveUrl(resolved)) {
    return undefined;
  }

  try {
    const url = new URL(resolved);
    if (
      (url.protocol === "http:" || url.protocol === "https:") &&
      allowedOrigins(policy).has(url.origin)
    ) {
      return url.href;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function resolveNavigationUrl(
  value: string,
  baseUrl?: string
): string | undefined {
  if (isActiveUrl(value)) {
    return undefined;
  }
  const resolved = resolveUrl(value, baseUrl);
  if (resolved === undefined || isActiveUrl(resolved)) {
    return undefined;
  }
  return resolved;
}

function rewriteSrcset(value: string, policy: ResourcePolicy): string {
  return value
    .split(",")
    .map((candidate) => candidate.trim())
    .filter(Boolean)
    .flatMap((candidate) => {
      const [url = "", ...descriptors] = candidate.split(/\s+/);
      const resolved = resolveResourceUrl(url, policy);
      if (resolved === undefined) {
        return [];
      }
      return [
        `${resolved}${descriptors.length > 0 ? ` ${descriptors.join(" ")}` : ""}`
      ];
    })
    .join(", ");
}

function rewriteCssUrls(
  value: string,
  policy: ResourcePolicy,
  context: "declarationList" | "stylesheet"
): string | undefined {
  try {
    const ast = parse(value, {
      context,
      parseCustomProperty: true
    });
    let unsafe = false;

    walk(ast, {
      enter: (node) => {
        const decodedFunctionName =
          node.type === "Function"
            ? decodeCssIdentifier(node.name ?? "").toLowerCase()
            : "";
        if (
          node.type === "Raw" ||
          (node.type === "Atrule" &&
            decodeCssIdentifier(node.name ?? "").toLowerCase() === "import") ||
          decodedFunctionName === "url" ||
          URL_STRING_FUNCTIONS.has(decodedFunctionName)
        ) {
          unsafe = true;
          return;
        }
        if (node.type === "Url") {
          const resolved = resolveResourceUrl(node.value ?? "", policy);
          if (resolved === undefined) {
            unsafe = true;
          } else {
            node.value = resolved;
          }
        }
      }
    });

    return unsafe ? undefined : generate(ast);
  } catch {
    return undefined;
  }
}

function isSvgElement(element: Element): boolean {
  return element.namespaceURI === "http://www.w3.org/2000/svg";
}

function isResourceHref(element: Element, attributeName: string): boolean {
  return (
    attributeName === "href" &&
    isSvgElement(element) &&
    SVG_RESOURCE_HREF_ELEMENTS.has(element.localName.toLowerCase())
  );
}

function rewriteSvgPresentationAttribute(
  attributeName: string,
  value: string,
  policy: ResourcePolicy
): string | undefined {
  const declaration = rewriteCssUrls(
    `${attributeName}:${value}`,
    policy,
    "declarationList"
  );
  if (declaration === undefined) {
    return undefined;
  }
  const separator = declaration.indexOf(":");
  return separator < 0 ? undefined : declaration.slice(separator + 1);
}

function sanitizeElement(element: Element, policy: ResourcePolicy): void {
  for (const attribute of Array.from(element.attributes)) {
    const attributeName = attribute.name.toLowerCase();

    if (attributeName.startsWith("on") || attributeName === "srcdoc") {
      element.removeAttribute(attribute.name);
      continue;
    }

    if (attributeName === "is") {
      element.removeAttribute(attribute.name);
      continue;
    }

    if (
      isSvgElement(element) &&
      SVG_CSS_URL_ATTRIBUTES.has(attributeName)
    ) {
      const value = rewriteSvgPresentationAttribute(
        attributeName,
        attribute.value,
        policy
      );
      if (value === undefined) {
        element.removeAttribute(attribute.name);
      } else {
        element.setAttribute(attribute.name, value);
      }
      continue;
    }

    if (
      RESOURCE_URL_ATTRIBUTES.has(attributeName) ||
      isResourceHref(element, attributeName)
    ) {
      const url = resolveResourceUrl(attribute.value, policy);
      if (url === undefined) {
        element.removeAttribute(attribute.name);
      } else {
        element.setAttribute(attribute.name, url);
      }
      continue;
    }

    if (NAVIGATION_URL_ATTRIBUTES.has(attributeName)) {
      const url = resolveNavigationUrl(attribute.value, policy.baseUrl);
      if (url === undefined) {
        element.removeAttribute(attribute.name);
      } else {
        element.setAttribute(attribute.name, url);
      }
      continue;
    }

    if (attributeName === "srcset") {
      const srcset = rewriteSrcset(attribute.value, policy);
      if (srcset.length === 0) {
        element.removeAttribute(attribute.name);
      } else {
        element.setAttribute(attribute.name, srcset);
      }
      continue;
    }

    if (attributeName === "style") {
      const style = rewriteCssUrls(attribute.value, policy, "declarationList");
      if (style === undefined) {
        element.removeAttribute(attribute.name);
      } else {
        element.setAttribute(attribute.name, style);
      }
    }
  }
}

function cloneInput(input: string | Element | DocumentFragment): DocumentFragment {
  const fragment = document.createDocumentFragment();

  if (typeof input === "string") {
    if (input.length > MAX_INPUT_CHARACTERS) {
      throw new PagedPdfError(
        "LIMIT_EXCEEDED",
        `HTML input exceeds the ${MAX_INPUT_CHARACTERS.toLocaleString()} character limit.`
      );
    }
    const template = document.createElement("template");
    template.innerHTML = input;
    fragment.append(template.content.cloneNode(true));
    return fragment;
  }

  fragment.append(input.cloneNode(true));
  return fragment;
}

function unwrapCustomElements(fragment: DocumentFragment): void {
  const customElements = Array.from(fragment.querySelectorAll("*")).filter(
    (element) => element.localName.includes("-")
  );
  for (const element of customElements) {
    element.replaceWith(...Array.from(element.childNodes));
  }
}

function removeBlockedSvgElements(fragment: DocumentFragment): void {
  fragment.querySelectorAll("*").forEach((element) => {
    if (
      isSvgElement(element) &&
      BLOCKED_SVG_ELEMENTS.has(element.localName.toLowerCase())
    ) {
      element.remove();
    }
  });
}

export function prepareStyleText(
  styleText: string,
  baseUrl?: string,
  allowedResourceOrigins?: readonly string[]
): string {
  if (styleText.length > MAX_INPUT_CHARACTERS) {
    throw new PagedPdfError(
      "LIMIT_EXCEEDED",
      `CSS input exceeds the ${MAX_INPUT_CHARACTERS.toLocaleString()} character limit.`
    );
  }
  const rewritten = rewriteCssUrls(
    styleText,
    { baseUrl, allowedResourceOrigins },
    "stylesheet"
  );
  if (rewritten === undefined) {
    throw new PagedPdfError(
      "INVALID_INPUT",
      "CSS contains invalid syntax, @import, unsupported image functions, raw syntax, or a resource URL outside allowedResourceOrigins."
    );
  }
  return rewritten;
}

export function prepareHtmlInput(
  input: string | Element | DocumentFragment,
  baseUrl?: string,
  allowedResourceOrigins?: readonly string[]
): DocumentFragment {
  if (
    typeof document === "undefined" ||
    (typeof input !== "string" &&
      !(input instanceof Element) &&
      !(input instanceof DocumentFragment))
  ) {
    throw new PagedPdfError(
      "INVALID_INPUT",
      "HTML input must be a string, Element, or DocumentFragment in a browser."
    );
  }

  const fragment = cloneInput(input);
  const elements = fragment.querySelectorAll("*");
  if (elements.length > MAX_DOM_ELEMENTS) {
    throw new PagedPdfError(
      "LIMIT_EXCEEDED",
      `HTML input exceeds the ${MAX_DOM_ELEMENTS.toLocaleString()} element limit.`
    );
  }

  fragment.querySelectorAll(BLOCKED_ELEMENTS).forEach((element) => {
    element.remove();
  });
  removeBlockedSvgElements(fragment);
  unwrapCustomElements(fragment);
  const policy = { baseUrl, allowedResourceOrigins };
  fragment.querySelectorAll("*").forEach((element) => {
    sanitizeElement(element, policy);
  });

  return fragment;
}
