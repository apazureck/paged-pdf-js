import { describe, expect, it } from "vitest";

import { prepareStyleText } from "../../src/sanitize.js";

describe("escaped CSS import security", () => {
  it("rejects escaped @import identifiers", () => {
    expect(() =>
      prepareStyleText(
        '@im\\70ort "https://tracker.invalid/import.css"; p { color: black; }'
      )
    ).toThrowError(
      expect.objectContaining({
        code: "INVALID_INPUT"
      })
    );
  });
});
