interface PageDimensions {
  readonly width: number;
  readonly height: number;
}

function positiveNumber(...candidates: readonly number[]): number | undefined {
  return candidates.find(
    (candidate) => Number.isFinite(candidate) && candidate > 0
  );
}

function measurePagebox(pagebox: HTMLElement): PageDimensions | undefined {
  const computedStyle = getComputedStyle(pagebox);
  const bounds = pagebox.getBoundingClientRect();
  const width = positiveNumber(
    Number.parseFloat(computedStyle.width),
    bounds.width,
    pagebox.offsetWidth
  );
  const height = positiveNumber(
    Number.parseFloat(computedStyle.height),
    bounds.height,
    pagebox.offsetHeight
  );

  return width === undefined || height === undefined
    ? undefined
    : { width, height };
}

export function synchronizePagedPageDimensions(root: ParentNode): number {
  return Array.from(root.querySelectorAll<HTMLElement>(".pagedjs_page")).reduce(
    (widestPage, page) => {
      const sheet = page.querySelector<HTMLElement>(".pagedjs_sheet");
      const pagebox = page.querySelector<HTMLElement>(".pagedjs_pagebox");
      if (sheet === null || pagebox === null) {
        return widestPage;
      }

      const dimensions = measurePagebox(pagebox);
      if (dimensions === undefined) {
        return widestPage;
      }

      const width = `${dimensions.width}px`;
      const height = `${dimensions.height}px`;
      page.style.width = width;
      page.style.height = height;
      sheet.style.width = width;
      sheet.style.height = height;

      return Math.max(widestPage, dimensions.width);
    },
    0
  );
}
