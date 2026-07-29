import { describe, expect, it } from "vitest";

import { materializeImageResources } from "../../src/image-materializer.js";

describe("non-image resource isolation", () => {
  it("removes passive browser-fetching attributes before pagination", async () => {
    const fragment = document.createDocumentFragment();
    const video = document.createElement("video");
    video.setAttribute("poster", "https://example.test/poster");
    video.setAttribute("src", "https://example.test/video");
    const audio = document.createElement("audio");
    audio.setAttribute("src", "https://example.test/audio");
    const source = document.createElement("source");
    source.setAttribute("src", "https://example.test/source");
    source.setAttribute("srcset", "https://example.test/source-2 2x");
    const imageInput = document.createElement("input");
    imageInput.type = "image";
    imageInput.setAttribute("src", "https://example.test/button");
    const table = document.createElement("table");
    const cell = document.createElement("td");
    table.setAttribute("background", "https://example.test/table");
    cell.setAttribute("background", "https://example.test/cell");
    table.append(cell);
    fragment.append(video, audio, source, imageInput, table);

    const cleanup = await materializeImageResources(fragment);

    for (const element of [video, audio, source, imageInput]) {
      expect(element.hasAttribute("src")).toBe(false);
    }
    expect(video.hasAttribute("poster")).toBe(false);
    expect(source.hasAttribute("srcset")).toBe(false);
    expect(table.hasAttribute("background")).toBe(false);
    expect(cell.hasAttribute("background")).toBe(false);
    cleanup();
  });
});
