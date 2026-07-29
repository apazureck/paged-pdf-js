import { describe, expect, it } from "vitest";

import { replaceRenderHost } from "../../demo/render-host.js";

describe("replaceRenderHost", () => {
  it("isolates late writes from a superseded Paged.js render", () => {
    const container = document.createElement("main");
    const staleHost = replaceRenderHost(container, 1);
    staleHost.textContent = "first";

    const currentHost = replaceRenderHost(container, 2);
    currentHost.textContent = "current";
    staleHost.append(" stale write");

    expect(staleHost.isConnected).toBe(false);
    expect(container.textContent).toBe("current");
    expect(container.querySelectorAll(".paged-render-host")).toHaveLength(1);
    expect(currentHost.dataset.renderToken).toBe("2");
  });
});
