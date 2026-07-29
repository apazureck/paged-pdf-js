import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
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
vi.mock("../../src/pdf-writer.js", () => ({
  writeVectorPdf: mocks.writeVectorPdf
}));
vi.mock("pagedjs", () => ({
  Previewer: class {
    public readonly polisher = {
      destroy: mocks.destroy,
      styleEl: document.createElement("style")
    };
    public readonly chunker = {
      flow: vi.fn()
    };

    public async preview(
      content: DocumentFragment,
      stylesheets: Array<string | Record<string, string>>,
      host: HTMLElement
    ): Promise<void> {
      document.head.append(this.polisher.styleEl);
      await mocks.preview(
        content,
        stylesheets,
        host,
        this.polisher,
        this.chunker
      );
    }
  }
}));

import { htmlToPdf } from "../../src/convert.js";

function appendPage(root: HTMLElement): void {
  const page = document.createElement("div");
  page.className = "pagedjs_page";
  const sheet = document.createElement("div");
  sheet.className = "pagedjs_sheet";
  page.append(sheet);
  root.append(page);
}

describe("HTML conversion isolation", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    mocks.buildVectorPage.mockReset().mockReturnValue({
      widthCssPixels: 100,
      heightCssPixels: 200,
      commands: []
    });
    mocks.destroy.mockReset();
    mocks.preview.mockReset().mockImplementation(
      (
        _content: DocumentFragment,
        _stylesheets: Array<string | Record<string, string>>,
        host: HTMLElement
      ) => appendPage(host)
    );
    mocks.waitForAssets.mockReset().mockResolvedValue(undefined);
    mocks.writeVectorPdf
      .mockReset()
      .mockResolvedValue(new Uint8Array([37, 80, 68, 70, 45]));
  });

  it("renders inside a temporary Shadow DOM boundary", async () => {
    await htmlToPdf("<article>Hello</article>");

    const [, , host, polisher] = mocks.preview.mock.calls[0] as [
      DocumentFragment,
      Array<string | Record<string, string>>,
      HTMLElement,
      { styleEl: HTMLStyleElement }
    ];
    const root = host.getRootNode();

    expect(root).toBeInstanceOf(ShadowRoot);
    expect(polisher.styleEl.getRootNode()).toBe(root);
    expect(document.querySelector("[data-paged-pdf-render-host]")).toBeNull();
  });

  it("stops while pagination is still pending", async () => {
    const controller = new AbortController();
    mocks.preview.mockImplementation(() => new Promise(() => undefined));

    const conversion = htmlToPdf("<p>Hello</p>", {
      signal: controller.signal
    });
    controller.abort("cancelled");

    await expect(conversion).rejects.toMatchObject({ code: "ABORTED" });
    expect(document.querySelector("[data-paged-pdf-render-host]")).toBeNull();
  });
});
