import type { PdfColor } from "./display-list.js";

const RGB_COLOR =
  /^rgba?\(\s*([\d.]+)(?:\s*,\s*|\s+)([\d.]+)(?:\s*,\s*|\s+)([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/iu;

export function parseCssColor(value: string): PdfColor | undefined {
  const normalized = value.trim().toLowerCase();
  if (normalized === "transparent") {
    return undefined;
  }
  const match = RGB_COLOR.exec(normalized);
  if (match === null) {
    return undefined;
  }
  const alphaText = match[4];
  const alpha =
    alphaText === undefined
      ? 1
      : alphaText.endsWith("%")
        ? Number.parseFloat(alphaText) / 100
        : Number.parseFloat(alphaText);
  if (!Number.isFinite(alpha) || alpha <= 0) {
    return undefined;
  }
  return [
    Math.min(255, Math.max(0, Math.round(Number(match[1])))),
    Math.min(255, Math.max(0, Math.round(Number(match[2])))),
    Math.min(255, Math.max(0, Math.round(Number(match[3]))))
  ];
}
