import { describe, expect, it } from "vitest";

import { prepareStyleText } from "../../src/sanitize.js";

describe("CSS image function security", () => {
  it.each(["image-set", "-webkit-image-set", "image"])(
    "rejects string URLs inside %s()",
    (functionName) => {
      expect(() =>
        prepareStyleText(
          `p { background-image: ${functionName}("https://tracker.invalid/pixel.png" 1x); }`
        )
      ).toThrowError(
        expect.objectContaining({
          code: "INVALID_INPUT"
        })
      );
    }
  );
});
