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

  it("turns uniform rounded backgrounds into vector commands", async () => {
    const page = document.createElement("div");
    const card = document.createElement("div");
    card.style.backgroundColor = "rgb(232, 243, 244)";
    card.style.borderRadius = "24px";
    page.append(card);
    document.body.append(page);
    place(page, 100, 50, 800, 1000);
    place(card, 140, 90, 200, 100);

    const result = await buildVectorPage(page);

    expect(result.commands).toContainEqual({
      kind: "roundedFill",
      x: 40,
      y: 40,
      width: 200,
      height: 100,
      radiusX: 24,
      radiusY: 24,
      color: [232, 243, 244]
    });
  });

  it("turns solid multi-column rules into vector fills", async () => {
    const page = document.createElement("div");
    const columns = document.createElement("div");
    columns.style.columnCount = "2";
    columns.style.columnGap = "40px";
    columns.style.columnRuleStyle = "solid";
    columns.style.columnRuleWidth = "2px";
    columns.style.columnRuleColor = "rgb(182, 198, 202)";
    columns.style.padding = "10px";
    columns.style.borderWidth = "4px";
    columns.style.borderStyle = "solid";
    columns.style.borderColor = "transparent";
    page.append(columns);
    document.body.append(page);
    place(page, 100, 50, 800, 1000);
    place(columns, 140, 90, 600, 400);

    const result = await buildVectorPage(page);

    expect(result.commands).toContainEqual({
      kind: "fill",
      x: 339,
      y: 54,
      width: 2,
      height: 372,
      color: [182, 198, 202]
    });
  });

  it("derives column rules from a declared column width", async () => {
    const page = document.createElement("div");
    const columns = document.createElement("div");
    columns.style.columnCount = "auto";
    columns.style.columnWidth = "200px";
    columns.style.columnGap = "40px";
    columns.style.columnRuleStyle = "solid";
    columns.style.columnRuleWidth = "2px";
    columns.style.columnRuleColor = "rgb(182, 198, 202)";
    page.append(columns);
    document.body.append(page);
    place(page, 100, 50, 800, 1000);
    place(columns, 140, 90, 600, 400);

    const result = await buildVectorPage(page);
    const rules = result.commands.filter(
      (command) =>
        command.kind === "fill" && command.color[0] === 182
    );

    expect(rules).toEqual([
      expect.objectContaining({ x: 339, y: 40, width: 2, height: 400 })
    ]);
  });

  it("turns laid-out text fragments into selectable text commands", async () => {
    const page = document.createElement("div");
    const paragraph = document.createElement("p");
    paragraph.style.color = "rgb(200, 10, 20)";
    paragraph.style.font = "700 16px Arial";
    paragraph.style.letterSpacing = "1.5px";
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
          letterSpacing: 1.5,
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

  it("renders static Paged.js margin-box content", async () => {
    const page = document.createElement("div");
    const marginBox = document.createElement("div");
    const marginContent = document.createElement("div");
    marginBox.className = "pagedjs_margin pagedjs_margin-top-left";
    marginContent.className = "pagedjs_margin-content";
    marginContent.style.textAlign = "left";
    marginBox.append(marginContent);
    page.append(marginBox);
    document.body.append(page);
    place(page, 100, 50, 816, 1056);
    place(marginContent, 124, 74, 240, 12);

    const getStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation(
      (element, pseudoElement) =>
        element === marginContent && pseudoElement === "::after"
          ? ({
              color: "rgb(20, 40, 60)",
              content: '"PAGED MEDIA FIELD NOTES"',
              display: "block",
              fontFamily: "Arial",
              fontSize: "10px",
              fontStyle: "normal",
              fontWeight: "700",
              opacity: "1",
              textTransform: "none",
              visibility: "visible"
            } as CSSStyleDeclaration)
          : getStyle(element, pseudoElement)
    );

    const result = await buildVectorPage(page);

    expect(result.commands).toContainEqual(
      expect.objectContaining({
        kind: "text",
        text: "PAGED MEDIA FIELD NOTES",
        x: 24,
        y: 24,
        fontFamily: "helvetica",
        fontStyle: "bold",
        fontSize: 10,
        color: [20, 40, 60]
      })
    );
  });

  it("measures named-page dimensions from the Paged.js pagebox", async () => {
    const sheet = document.createElement("div");
    const pagebox = document.createElement("div");
    pagebox.className = "pagedjs_pagebox";
    sheet.append(pagebox);
    document.body.append(sheet);
    place(sheet, 100, 50, 816, 1056);
    place(pagebox, 100, 50, 1122, 794);

    const result = await buildVectorPage(sheet);

    expect(result).toMatchObject({
      widthCssPixels: 1122,
      heightCssPixels: 794
    });
  });
});
