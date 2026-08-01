import { describe, expect, it } from "vitest";

import { repeatSplitTableHeaders } from "../../demo/table-headers.js";

describe("Paged.js split table headers", () => {
  it("clones the original header into continuation fragments", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <section class="pagedjs_page">
        <table
          data-ref="survey"
          data-split-to="survey"
          data-split-original="true"
        >
          <thead data-ref="survey-head">
            <tr><th>Station</th><th>Habitat</th><th>Index</th></tr>
          </thead>
          <tbody><tr><td>ST-01</td><td>Salt marsh</td><td>72</td></tr></tbody>
        </table>
      </section>
      <section class="pagedjs_page">
        <table data-ref="survey-continuation" data-split-from="survey">
          <tbody><tr><td>ST-13</td><td>Salt marsh</td><td>84</td></tr></tbody>
        </table>
      </section>
    `;

    repeatSplitTableHeaders(root);
    repeatSplitTableHeaders(root);

    const tables = root.querySelectorAll("table");
    const originalHeader = tables[0]?.querySelector("thead");
    const continuationHeaders = tables[1]?.querySelectorAll("thead");

    expect(originalHeader?.textContent).toContain("Station");
    expect(continuationHeaders).toHaveLength(1);
    expect(continuationHeaders?.[0]?.textContent).toContain("Habitat");
    expect(continuationHeaders?.[0]).not.toBe(originalHeader);
    expect(tables[1]?.firstElementChild?.tagName).toBe("THEAD");
  });

  it("leaves unrelated and already complete tables unchanged", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <table data-ref="standalone"><tbody><tr><td>Only</td></tr></tbody></table>
      <table data-ref="complete" data-split-from="complete">
        <thead><tr><th>Existing</th></tr></thead>
        <tbody><tr><td>Row</td></tr></tbody>
      </table>
    `;
    const before = root.innerHTML;

    repeatSplitTableHeaders(root);

    expect(root.innerHTML).toBe(before);
  });
});
