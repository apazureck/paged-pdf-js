import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildRasterPage: vi.fn(),
  buildVectorPage: vi.fn(),
  destroy: vi.fn(),
  preview: vi.fn(),
  waitForAssets: vi.fn(),
  writeVectorPdf: vi.fn()
}));

vi.mock("../../src/assets.js", () => ({
  waitForAssets: mocks.waitForAssets
}));
vi.mock("../../src/dom-renderer.js", () => ({
  buildVectorPage: mocks.buildVectorPage
}));
vi.mock("../../src/raster-renderer.js", () => ({
  buildRasterPage: mocks.buildRasterPage
}));
vi.mock("../../src/pdf-writer.js", () => ({
  writeVectorPdf: mocks.writeVectorPdf
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
const VECTOR_PAGE = {
  widthCssPixels: 100,
  heightCssPixels: 200,
  commands: []
} as const;

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
    mocks.buildRasterPage.mockReset().mockResolvedValue({
      ...VECTOR_PAGE,
      commands: [{
        kind: "image",
        source: "data:image/png;base64,AA==",
        x: 0,
        y: 0,
        width: 100,
        height: 200
      }]
    });
    mocks.buildVectorPage.mockReset().mockReturnValue(VECTOR_PAGE);
    mocks.destroy.mockReset();
    mocks.preview.mockReset();
    mocks.waitForAssets.mockReset().mockResolvedValue(undefined);
    mocks.writeVectorPdf.mockReset().mockImplementation(
      async (
        pages: readonly unknown[],
        options: { onPageWritten?: (page: number) => void }
      ) => {
        pages.forEach((_page, index) => options.onPageWritten?.(index + 1));
        return PDF_BYTES;
      }
    );
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
    expect(mocks.buildVectorPage).toHaveBeenCalledTimes(2);
    expect(mocks.writeVectorPdf).toHaveBeenCalledWith(
      [VECTOR_PAGE, VECTOR_PAGE],
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
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

  it("keeps vector rendering as the default", async () => {
    const root = document.createElement("main");
    appendPage(root);

    await pagedDomToPdf(root);

    expect(mocks.buildVectorPage).toHaveBeenCalledOnce();
    expect(mocks.buildRasterPage).not.toHaveBeenCalled();
  });

  it("uses a page image in raster mode", async () => {
    const root = document.createElement("main");
    appendPage(root);

    await pagedDomToPdf(root, { renderMode: "raster" });

    expect(mocks.buildRasterPage).toHaveBeenCalledOnce();
    expect(mocks.buildVectorPage).not.toHaveBeenCalled();
  });

  it("keeps searchable text and links over the image in hybrid mode", async () => {
    const root = document.createElement("main");
    appendPage(root);
    mocks.buildVectorPage.mockResolvedValue({
      ...VECTOR_PAGE,
      commands: [
        {
          kind: "fill",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          color: [0, 0, 0]
        },
        {
          kind: "text",
          text: "Searchable",
          x: 1,
          y: 1,
          fontFamily: "helvetica",
          fontStyle: "normal",
          fontSize: 12,
          letterSpacing: 0,
          color: [0, 0, 0]
        },
        {
          kind: "link",
          x: 1,
          y: 1,
          width: 10,
          height: 10,
          url: "https://example.com/"
        }
      ]
    });

    await pagedDomToPdf(root, { renderMode: "hybrid" });

    const writtenPage = mocks.writeVectorPdf.mock.calls[0]?.[0][0];
    expect(writtenPage.commands.map((command: { kind: string }) => command.kind))
      .toEqual(["image", "text", "link"]);
    expect(writtenPage.commands[1]).toMatchObject({ opacity: 0 });
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
