import { describe, expect, it } from "vitest";

import { synchronizePagedPageDimensions } from "../../demo/paged-preview-layout.js";

function createPage(width: number, height: number): HTMLElement {
  const page = document.createElement("div");
  page.className = "pagedjs_page";
  page.style.width = "816px";
  page.style.height = "1056px";

  const sheet = document.createElement("div");
  sheet.className = "pagedjs_sheet";
  sheet.style.width = "816px";
  sheet.style.height = "1056px";

  const pagebox = document.createElement("div");
  pagebox.className = "pagedjs_pagebox";
  pagebox.style.width = `${width}px`;
  pagebox.style.height = `${height}px`;

  sheet.append(pagebox);
  page.append(sheet);
  return page;
}

describe("synchronizePagedPageDimensions", () => {
  it("sizes every preview wrapper to its pagebox and returns the widest page", () => {
    const host = document.createElement("div");
    const portraitPage = createPage(559, 794);
    const landscapePage = createPage(1122.5, 793.688);
    host.append(portraitPage, landscapePage);

    const widestPage = synchronizePagedPageDimensions(host);

    expect(widestPage).toBe(1122.5);
    expect(portraitPage.style.width).toBe("559px");
    expect(portraitPage.querySelector<HTMLElement>(".pagedjs_sheet")?.style.width)
      .toBe("559px");
    expect(landscapePage.style.width).toBe("1122.5px");
    expect(landscapePage.style.height).toBe("793.688px");
    expect(landscapePage.querySelector<HTMLElement>(".pagedjs_sheet")?.style.width)
      .toBe("1122.5px");
  });
});
