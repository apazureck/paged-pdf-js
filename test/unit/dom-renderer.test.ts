import { afterEach, describe, expect, it, vi } from "vitest";

import { buildVectorPage } from "../../src/dom-renderer.js";

function rectangle(
  left: number,
  top: number,
  width: number,
  height: number
): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({})
  };
}

function place(
  element: Element,
  left: number,
  top: number,
  width: number,
  height: number
): void {
  const bounds = rectangle(left, top, width, height);
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(bounds);
  vi.spyOn(element, "getClientRects").mockReturnValue(
    [bounds] as unknown as DOMRectList
  );
}

describe("Paged DOM vector translation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("creates explicit fills, solid borders, images, and links", async () => {
    const page = document.createElement("div");
    const box = document.createElement("div");
    box.style.backgroundColor = "rgb(10, 20, 30)";
    box.style.border = "4px solid rgb(40, 50, 60)";
    const image = document.createElement("img");
    image.src =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";
    const link = document.createElement("a");
    link.href = "https://example.com/";
    link.textContent = "";
    page.append(box, image, link);
    document.body.append(page);
    place(page, 100, 50, 816, 1056);
    place(box, 124, 74, 240, 80);
    place(image, 124, 170, 96, 48);
    place(link, 124, 230, 144, 24);

    const result = await buildVectorPage(page);

    expect(result).toMatchObject({
      widthCssPixels: 816,
      heightCssPixels: 1056
    });
    expect(result.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "fill",
          x: 24,
          y: 24,
          width: 240,
          height: 80,
          color: [10, 20, 30]
        }),
        expect.objectContaining({
          kind: "image",
          x: 24,
          y: 120,
          width: 96,
          height: 48
        }),
        expect.objectContaining({
          kind: "link",
          x: 24,
          y: 180,
          url: "https://example.com/"
        })
      ])
    );
    expect(
      result.commands.filter(
        (command) =>
          command.kind === "fill" &&
          command.color[0] === 40 &&
          command.color[1] === 50
      )
    ).toHaveLength(4);
  });

  it("turns laid-out text fragments into selectable text commands", async () => {
    const page = document.createElement("div");
    const paragraph = document.createElement("p");
    paragraph.style.color = "rgb(200, 10, 20)";
    paragraph.style.font = "700 16px Arial";
    paragraph.textContent = "Vector text";
    page.append(paragraph);
    document.body.append(page);
    place(page, 100, 50, 816, 1056);
    place(paragraph, 196, 146, 160, 24);
    vi.spyOn(document, "createRange").mockImplementation(
      () =>
        ({
          setStart: vi.fn(),
          setEnd: vi.fn(),
          getClientRects: () => [rectangle(196, 146, 80, 20)],
          detach: vi.fn()
        }) as unknown as Range
    );

    const before = page.outerHTML;
    const result = await buildVectorPage(page);

    expect(result.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "text",
          text: expect.stringContaining("Vector"),
          x: 96,
          y: 96,
          fontFamily: "helvetica",
          fontStyle: "bold",
          fontSize: 16,
          color: [200, 10, 20]
        })
      ])
    );
    expect(page.outerHTML).toBe(before);
  });

  it("does not duplicate words split across client rectangles", async () => {
    const page = document.createElement("div");
    const heading = document.createElement("h1");
    heading.textContent = "Chapter I:";
    page.append(heading);
    document.body.append(page);
    place(page, 100, 50, 816, 1056);
    place(heading, 196, 146, 160, 24);

    vi.spyOn(document, "createRange").mockImplementation(() => {
      let start = 0;
      let end = 0;
      return {
        setStart: vi.fn((_node: Node, offset: number) => {
          start = offset;
        }),
        setEnd: vi.fn((_node: Node, offset: number) => {
          end = offset;
        }),
        getClientRects: () =>
          start === 0 && end === 8
            ? [
                rectangle(196, 146, 10, 20),
                rectangle(206, 146, 70, 20)
              ]
            : [rectangle(196 + start * 10, 146, (end - start) * 10, 20)],
        detach: vi.fn()
      } as unknown as Range;
    });

    const result = await buildVectorPage(page);
    const text = result.commands
      .filter((command) => command.kind === "text")
      .map((command) => command.text)
      .join("");

    expect(text).toBe("Chapter I:");
  });
});
