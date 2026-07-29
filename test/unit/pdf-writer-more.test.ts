import { describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";

import { writeRasterPdf } from "../../src/pdf-writer.js";

const SINGLE_PIXEL_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XwWfGQAAAABJRU5ErkJggg==";

describe("PDF writer options and failures", () => {
  it("sets metadata and reports each written page", async () => {
    const onPageWritten = vi.fn();
    const bytes = await writeRasterPdf(
      [
        {
          dataUrl: SINGLE_PIXEL_PNG,
          widthCssPixels: 96,
          heightCssPixels: 96
        }
      ],
      {
        title: "Title",
        author: "Author",
        subject: "Subject",
        keywords: ["one", "two"],
        onPageWritten
      }
    );
    const document = await PDFDocument.load(bytes);

    expect(document.getTitle()).toBe("Title");
    expect(document.getAuthor()).toBe("Author");
    expect(document.getSubject()).toBe("Subject");
    expect(document.getKeywords()).toContain("one");
    expect(document.getCreator()).toBe("paged-pdf-js");
    expect(onPageWritten).toHaveBeenCalledWith(1);
  });

  it("preserves typed size and abort errors", async () => {
    await expect(
      writeRasterPdf([
        {
          dataUrl: SINGLE_PIXEL_PNG,
          widthCssPixels: 0,
          heightCssPixels: 96
        }
      ])
    ).rejects.toMatchObject({ code: "INVALID_PAGE_SIZE" });

    const controller = new AbortController();
    controller.abort("stop");
    await expect(
      writeRasterPdf([], { signal: controller.signal })
    ).rejects.toMatchObject({ code: "ABORTED", cause: "stop" });
  });
});
