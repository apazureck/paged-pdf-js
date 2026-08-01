import { generate, parse, walk } from "css-tree";

import type { GalleryExample } from "./gallery-types.js";

export interface PlaygroundSettings {
  readonly marginMm: number;
  readonly fontSizePt: number;
  readonly lineHeight: number;
  readonly paragraphGapMm: number;
  readonly headingSizePt: number;
}

interface CssTreeNode {
  readonly type: string;
  readonly name?: string;
  readonly prelude?: CssTreeNode | null;
}

interface SettingDefinition {
  readonly parameter: string;
  readonly minimum: number;
  readonly maximum: number;
  readonly step: number;
}

export const defaultPlaygroundSettings: PlaygroundSettings = {
  marginMm: 18,
  fontSizePt: 11,
  lineHeight: 1.5,
  paragraphGapMm: 4,
  headingSizePt: 18
};

const definitions: {
  readonly [Key in keyof PlaygroundSettings]: SettingDefinition;
} = {
  marginMm: { parameter: "margin", minimum: 5, maximum: 40, step: 1 },
  fontSizePt: { parameter: "text", minimum: 8, maximum: 16, step: 0.5 },
  lineHeight: { parameter: "leading", minimum: 1.1, maximum: 2, step: 0.05 },
  paragraphGapMm: { parameter: "gap", minimum: 0, maximum: 8, step: 0.5 },
  headingSizePt: { parameter: "heading", minimum: 18, maximum: 42, step: 1 }
};

function formatNumber(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function normalizeValue(
  rawValue: string | null,
  fallback: number,
  definition: SettingDefinition
): number {
  if (rawValue === null) {
    return fallback;
  }
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  const clamped = Math.min(
    definition.maximum,
    Math.max(definition.minimum, parsed)
  );
  const quantized =
    definition.minimum +
    Math.round((clamped - definition.minimum) / definition.step) *
      definition.step;
  return Number(quantized.toFixed(2));
}

export function readPlaygroundSettings(search: string): PlaygroundSettings {
  const parameters = new URLSearchParams(search);
  return Object.fromEntries(
    Object.entries(definitions).map(([key, definition]) => [
      key,
      normalizeValue(
        parameters.get(definition.parameter),
        defaultPlaygroundSettings[key as keyof PlaygroundSettings],
        definition
      )
    ])
  ) as unknown as PlaygroundSettings;
}

export function writePlaygroundSettings(
  settings: PlaygroundSettings
): string {
  const parameters = new URLSearchParams();
  for (const [key, definition] of Object.entries(definitions)) {
    parameters.set(
      definition.parameter,
      formatNumber(settings[key as keyof PlaygroundSettings])
    );
  }
  return `?${parameters.toString()}`;
}

function pageSelectors(sourceCss: string): readonly string[] {
  const selectors = new Set<string>();
  const ast = parse(sourceCss, { context: "stylesheet" }) as CssTreeNode;
  walk(ast, (node) => {
    const atRule = node as CssTreeNode;
    if (atRule.type !== "Atrule" || atRule.name?.toLowerCase() !== "page") {
      return;
    }
    const selector =
      atRule.prelude === null || atRule.prelude === undefined
        ? ""
        : generate(atRule.prelude).trim();
    selectors.add(selector);
  });
  if (selectors.size === 0) {
    selectors.add("");
  }
  return [...selectors];
}

function buildPlaygroundCss(
  sourceCss: string,
  settings: PlaygroundSettings,
  fixedPageMarginSelectors: readonly string[]
): string {
  const margin = formatNumber(settings.marginMm);
  const pageRules = pageSelectors(sourceCss)
    .filter((selector) => !fixedPageMarginSelectors.includes(selector))
    .map(
      (selector) => `@page${selector === "" ? "" : ` ${selector}`} {
  margin: ${margin}mm !important;
}`
    )
    .join("\n");

  return `/* Live playground overrides */
${pageRules}
body {
  font-size: ${formatNumber(settings.fontSizePt)}pt !important;
  line-height: ${formatNumber(settings.lineHeight)} !important;
}
h1 {
  font-size: ${formatNumber(settings.headingSizePt)}pt !important;
}
p:not(.eyebrow) {
  margin-bottom: ${formatNumber(settings.paragraphGapMm)}mm !important;
}`;
}

export function applyPlaygroundSettings(
  example: GalleryExample,
  settings: PlaygroundSettings
): GalleryExample {
  return {
    ...example,
    css: `${example.css.trim()}\n\n${buildPlaygroundCss(
      example.css,
      settings,
      example.fixedPageMarginSelectors ?? []
    )}`
  };
}
