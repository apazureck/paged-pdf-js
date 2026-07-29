import { afterEach, describe, expect, it, vi } from "vitest";

import { buildVectorPage } from "../../src/dom-renderer.js";

function rectangle(width: number, height: number): DOMRect {
  return {
    left: 0,
    top: 0,
    width,
    height,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({})
  };
}

describe("DOM translation resource limits", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("rejects oversized page geometry", async () => {
    const page = document.createElement("div");
    vi.spyOn(page, "getBoundingClientRect").mockReturnValue(
      rectangle(20_001, 100)
    );

    await expect(buildVectorPage(page)).rejects.toMatchObject({
      code: "LIMIT_EXCEEDED"
    });
  });

  it("checks abort signals during large element traversals", async () => {
    const page = document.createElement("div");
    page.append(
      ...Array.from({ length: 251 }, () => document.createElement("span"))
    );
    document.body.append(page);
    vi.spyOn(page, "getBoundingClientRect").mockReturnValue(
      rectangle(800, 1000)
    );
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 0);

    await expect(
      buildVectorPage(page, controller.signal)
    ).rejects.toMatchObject({ code: "ABORTED" });
  });

  it("checks abort signals inside one large text node", async () => {
    const page = document.createElement("div");
    const paragraph = document.createElement("p");
    paragraph.textContent = "word ".repeat(300);
    page.append(paragraph);
    document.body.append(page);
    vi.spyOn(page, "getBoundingClientRect").mockReturnValue(
      rectangle(800, 1000)
    );
    vi.spyOn(document, "createRange").mockImplementation(
      () =>
        ({
          setStart: vi.fn(),
          setEnd: vi.fn(),
          getClientRects: () => [],
          detach: vi.fn()
        }) as unknown as Range
    );
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 0);

    await expect(
      buildVectorPage(page, controller.signal)
    ).rejects.toMatchObject({ code: "ABORTED" });
  });

  it("caps text characters independently of emitted commands", async () => {
    const page = document.createElement("div");
    page.textContent = "x".repeat(1_000_001);
    document.body.append(page);
    vi.spyOn(page, "getBoundingClientRect").mockReturnValue(
      rectangle(800, 1000)
    );

    await expect(buildVectorPage(page)).rejects.toMatchObject({
      code: "LIMIT_EXCEEDED"
    });
  });

  it("stops appending drawing commands at the per-page limit", async () => {
    const page = document.createElement("div");
    const box = document.createElement("div");
    box.style.backgroundColor = "rgb(1, 2, 3)";
    page.append(box);
    document.body.append(page);
    vi.spyOn(page, "getBoundingClientRect").mockReturnValue(
      rectangle(800, 1000)
    );
    vi.spyOn(box, "getBoundingClientRect").mockReturnValue(
      rectangle(10, 10)
    );
    vi.spyOn(box, "getClientRects").mockReturnValue(
      Array.from({ length: 25_001 }, () =>
        rectangle(10, 10)
      ) as unknown as DOMRectList
    );

    await expect(buildVectorPage(page)).rejects.toMatchObject({
      code: "LIMIT_EXCEEDED"
    });
  });
});
