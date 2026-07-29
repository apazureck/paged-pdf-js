import { PagedPdfError } from "./errors.js";

function isHidden(element: HTMLElement): boolean {
  if (element.hidden || element.closest("template") !== null) {
    return true;
  }

  const style = globalThis.getComputedStyle?.(element);
  return style?.display === "none" || style?.visibility === "hidden";
}

export function collectPagedSheets(root: ParentNode): HTMLElement[] {
  const pages = Array.from(
    root.querySelectorAll<HTMLElement>(".pagedjs_page")
  ).filter((page) => !isHidden(page));

  const sheets = pages.map(
    (page) =>
      page.querySelector<HTMLElement>(".pagedjs_sheet") ??
      page.querySelector<HTMLElement>(".pagedjs_pagebox") ??
      page
  );

  if (sheets.length === 0) {
    throw new PagedPdfError(
      "NO_PAGES",
      "No visible Paged.js pages were found in the supplied DOM root."
    );
  }

  return sheets;
}
