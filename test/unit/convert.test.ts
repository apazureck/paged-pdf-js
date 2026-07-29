import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  capturePage: vi.fn(),
  destroy: vi.fn(),
  preview: vi.fn(),
  waitForAssets: vi.fn(),
  writeRasterPdf: vi.fn()
}));

vi.mock("../../src/assets.js", () => ({
  waitForAssets: mocks.waitForAssets
}));
vi.mock("../../src/capture.js", () => ({
  capturePage: mocks.capturePage
}));
vi.mock("../../src/pdf-writer.js", () => ({
  writeRasterPdf: mocks.writeRasterPdf
}));
vi.mock("pagedjs", () => ({
  Previewer: class {
    public readonly polisher = { destroy: mocks.destroy };
    public async preview(
      content: DocumentFragment,
      stylesheets: Array<string | Record<string, string>>,
      host: HTMLElement
    ): Promise<void> {
      await mocks.preview(content, stylesheets, host);
    }
  }
}));

import { htmlToPdf, pagedDomToPdf } from "../../src/convert.js";

const PDF_BYTES = new Uint8Array([37, 80, 68, 70, 45]);

function appendPage(root: HTMLElement): void {
  const page = document.createElement("div");
  page.className = "pagedjs_page";
  const sheet = document.createElement("div");
  sheet.className = "pagedjs_sheet";
  page.append(sheet);
  root.append(page);
}

describe("conversion orchestration", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    mocks.capturePage.mockReset();
    mocks.destroy.mockReset();
    mocks.preview.mockReset();
    mocks.waitForAssets.mockReset().mockResolvedValue(undefined);
    mocks.writeRasterPdf.mockReset().mockImplementation(
      async (
        pages: AsyncIterable<unknown>,
        options: { onPageWritten?: (page: number) => void }
      ) => {
        let page = 0;
        for await (const _rasterPage of pages) {
          page += 1;
          options.onPageWritten?.(page);
        }
        return PDF_BYTES;
      }
    );
    mocks.capturePage.mockResolvedValue({
      dataUrl: "data:image/png;base64,page",
      widthCssPixels: 100,
      heightCssPixels: 200,
      format: "png"
    });
    mocks.preview.mockImplementation(
      (
        _content: DocumentFragment,
        _stylesheets: Array<string | Record<string, string>>,
        host: HTMLElement
      ) => appendPage(host)
    );
  });

  it("converts existing paged DOM and reports progress", async () => {
    const root = document.createElement("main");
    appendPage(root);
    appendPage(root);
    const onProgress = vi.fn();

    const result = await pagedDomToPdf(root, { onProgress });

    expect(result.pageCount).toBe(2);
    expect(result.bytes).toEqual(PDF_BYTES);
    expect(result.blob.type).toBe("application/pdf");
    expect(mocks.waitForAssets).toHaveBeenCalledWith(
      root,
      expect.any(AbortSignal)
    );
    expect(mocks.capturePage).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenCalledWith({
      phase: "assets",
      totalPages: 2
    });
    expect(onProgress).toHaveBeenCalledWith({
      phase: "render",
      page: 1,
      totalPages: 2
    });
    expect(onProgress).toHaveBeenCalledWith({
      phase: "write",
      page: 2,
      totalPages: 2
    });
  });

  it("paginates sanitized HTML and cleans temporary styles", async () => {
    const onProgress = vi.fn();
    const result = await htmlToPdf(
      `<article onclick="bad()"><script>bad()</script>Hello</article>`,
      {
        styleText: "@page { size: A4 }",
        onProgress
      }
    );

    expect(result.pageCount).toBe(1);
    const [content, stylesheets, host] = mocks.preview.mock.calls[0] as [
      DocumentFragment,
      Array<string | Record<string, string>>,
      HTMLElement
    ];
    expect(content.querySelector("script")).toBeNull();
    expect(content.querySelector("article")?.hasAttribute("onclick")).toBe(
      false
    );
    expect(stylesheets).toEqual([
      {
        [document.location.href]: "@page{size:A4}"
      }
    ]);
    expect(host.getRootNode()).toBeInstanceOf(ShadowRoot);
    expect(onProgress).toHaveBeenCalledWith({ phase: "paginate" });
    expect(mocks.destroy).toHaveBeenCalledOnce();
    expect(document.querySelector("[data-paged-pdf-render-host]")).toBeNull();
  });

  it("rejects external stylesheet URLs", async () => {
    await expect(
      htmlToPdf("<p>Hello</p>", { stylesheets: ["/print.css"] })
    ).rejects.toMatchObject({ code: "INVALID_OPTION" });
    expect(mocks.preview).not.toHaveBeenCalled();
  });

  it("wraps pagination failures and always cleans up", async () => {
    mocks.preview.mockRejectedValue(new Error("Paged.js failed"));

    await expect(htmlToPdf("<p>Hello</p>")).rejects.toMatchObject({
      code: "PAGINATION_FAILED"
    });
    expect(mocks.destroy).toHaveBeenCalledOnce();
    expect(document.querySelector("[data-paged-pdf-render-host]")).toBeNull();
  });

  it("stops before pagination when already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      htmlToPdf("<p>Hello</p>", { signal: controller.signal })
    ).rejects.toMatchObject({ code: "ABORTED" });
    expect(mocks.preview).not.toHaveBeenCalled();
  });
});
