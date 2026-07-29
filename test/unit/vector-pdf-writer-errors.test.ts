import { describe, expect, it } from "vitest";

import { writeVectorPdf } from "../../src/pdf-writer.js";

describe("vector PDF writer errors", () => {
  it("preserves abort errors", async () => {
    const controller = new AbortController();
    controller.abort("stop");

    await expect(
      writeVectorPdf(
        [{ widthCssPixels: 96, heightCssPixels: 96, commands: [] }],
        { signal: controller.signal }
      )
    ).rejects.toMatchObject({ code: "ABORTED", cause: "stop" });
  });

  it("wraps an empty page list as a PDF write error", async () => {
    await expect(writeVectorPdf([])).rejects.toMatchObject({
      code: "PDF_WRITE_FAILED"
    });
  });
});
