import { Previewer } from "pagedjs";
import { pagedDomToPdf } from "../src/index.js";
import {
  materializeFootnoteMarkers,
  prepareFootnoteLabels
} from "./footnote-markers.js";
import { synchronizePagedPageDimensions } from "./paged-preview-layout.js";
import { replaceRenderHost } from "./render-host.js";
import { repeatSplitTableHeaders } from "./table-headers.js";

interface RenderMessage {
  readonly type: "render-paged-example";
  readonly token: number;
  readonly html: string;
  readonly css: string;
  readonly title: string;
}

interface ScaleMessage {
  readonly type: "scale-paged-example";
  readonly token: number;
}

interface CancelMessage {
  readonly type: "cancel-paged-example";
  readonly token: number;
}

type GalleryMessage = CancelMessage | RenderMessage | ScaleMessage;
const PAGINATION_TIMEOUT_MS = 45_000;

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Paged preview element is missing: ${selector}`);
  }
  return element;
}

const preview = requireElement<HTMLElement>("#preview");
let previewer: Previewer | undefined;
let activeController: AbortController | undefined;
let activeHost: HTMLElement | undefined;
let activeToken = 0;
let naturalPageWidth = 0;
let renderQueue = Promise.resolve();

function postToParent(message: Record<string, unknown>): void {
  window.parent.postMessage(message, window.location.origin);
}

function stopActiveRender(): void {
  activeController?.abort();
  previewer?.chunker?.stop?.();
  activeHost?.remove();
  activeHost = undefined;
}

function applyScale(): void {
  const pages = activeHost?.querySelector<HTMLElement>(".pagedjs_pages");
  if (pages === null || pages === undefined || naturalPageWidth <= 0) {
    return;
  }
  pages.style.zoom = "1";
  const availableWidth = Math.max(
    240,
    document.documentElement.clientWidth - 40
  );
  pages.style.zoom = String(Math.min(1, availableWidth / naturalPageWidth));
}

async function paginate(
  instance: Previewer,
  content: DocumentFragment,
  css: string,
  host: HTMLElement,
  controller: AbortController
): Promise<void> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const interrupted = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener(
      "abort",
      () => {
        reject(
          timedOut
            ? new Error("Paged.js pagination timed out.")
            : new DOMException("Pagination was aborted.", "AbortError")
        );
      },
      { once: true }
    );
    timeoutId = setTimeout(() => {
      timedOut = true;
      instance.chunker?.stop?.();
      controller.abort();
    }, PAGINATION_TIMEOUT_MS);
  });

  try {
    await Promise.race([
      instance.preview(
        content,
        [{ [window.location.href]: css }],
        host
      ),
      interrupted
    ]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

async function render(message: RenderMessage): Promise<void> {
  if (activeToken !== message.token) {
    return;
  }

  const controller = new AbortController();
  activeController = controller;
  naturalPageWidth = 0;
  previewer?.polisher?.destroy();
  const host = replaceRenderHost(preview, message.token);
  activeHost = host;

  const template = document.createElement("template");
  template.innerHTML = message.html;
  const content = template.content.cloneNode(true) as DocumentFragment;
  prepareFootnoteLabels(content);
  const instance = new Previewer();
  previewer = instance;

  try {
    await paginate(
      instance,
      content,
      message.css,
      host,
      controller
    );
    if (
      controller.signal.aborted ||
      activeToken !== message.token ||
      activeHost !== host ||
      !host.isConnected
    ) {
      return;
    }

    repeatSplitTableHeaders(host);
    materializeFootnoteMarkers(host);
    const htmlPageCount = host.querySelectorAll(".pagedjs_page").length;
    naturalPageWidth = synchronizePagedPageDimensions(host);
    const result = await pagedDomToPdf(host, {
      signal: controller.signal,
      metadata: {
        title: `${message.title} | paged-pdf.js feature lab`,
        author: "paged-pdf-js"
      },
      onProgress: ({ phase, page, totalPages }) => {
        if (
          !controller.signal.aborted &&
          activeToken === message.token &&
          activeHost === host
        ) {
          postToParent({
            type: "paged-example-progress",
            token: message.token,
            phase,
            page,
            totalPages
          });
        }
      }
    });
    if (
      controller.signal.aborted ||
      activeToken !== message.token ||
      activeHost !== host ||
      !host.isConnected
    ) {
      return;
    }

    const pdfBytes = Uint8Array.from(result.bytes);
    window.parent.postMessage(
      {
        type: "paged-example-ready",
        token: message.token,
        htmlPageCount,
        pdfPageCount: result.pageCount,
        pdfBytes
      },
      window.location.origin,
      [pdfBytes.buffer]
    );
  } catch (error) {
    if (controller.signal.aborted && activeToken !== message.token) {
      return;
    }
    postToParent({
      type: "paged-example-error",
      token: message.token,
      message: error instanceof Error ? error.message : "Pagination failed."
    });
  } finally {
    if (activeController === controller) {
      activeController = undefined;
    }
  }
}

function queueRender(message: RenderMessage): void {
  activeToken = message.token;
  stopActiveRender();
  renderQueue = renderQueue
    .catch(() => undefined)
    .then(async () => {
      if (activeToken === message.token) {
        await render(message);
      }
    });
}

window.addEventListener("message", (event: MessageEvent<GalleryMessage>) => {
  if (event.origin !== window.location.origin || event.source !== window.parent) {
    return;
  }
  if (event.data.type === "render-paged-example") {
    queueRender(event.data);
    return;
  }
  if (
    event.data.type === "cancel-paged-example" &&
    event.data.token === activeToken
  ) {
    stopActiveRender();
    return;
  }
  if (
    event.data.type === "scale-paged-example" &&
    event.data.token === activeToken
  ) {
    applyScale();
  }
});

window.addEventListener("resize", () => {
  if (naturalPageWidth > 0) {
    applyScale();
  }
});

window.addEventListener("beforeunload", stopActiveRender);
postToParent({ type: "paged-preview-frame-ready" });
