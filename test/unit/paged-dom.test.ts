import { beforeEach, describe, expect, it } from "vitest";

import type { PagedPdfError } from "../../src/errors.js";
import { collectPagedSheets } from "../../src/paged-dom.js";

describe("Paged.js DOM collection", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("collects visible page sheets in document order", () => {
    document.body.innerHTML = `
      <main id="root">
        <div class="pagedjs_page"><div id="first" class="pagedjs_sheet"></div></div>
        <template><div class="pagedjs_page"><div id="template"></div></div></template>
        <div class="pagedjs_page" hidden><div id="hidden"></div></div>
        <div class="pagedjs_page"><div id="second" class="pagedjs_pagebox"></div></div>
      </main>
    `;

    const sheets = collectPagedSheets(
      document.querySelector<HTMLElement>("#root")!
    );

    expect(sheets.map((element) => element.id)).toEqual(["first", "second"]);
  });

  it("throws a stable error when no pages exist", () => {
    expect(() => collectPagedSheets(document.body)).toThrowError(
      expect.objectContaining<Partial<PagedPdfError>>({ code: "NO_PAGES" })
    );
  });
});
