import { downloadPdf, type PdfResult } from "../src/index.js";
import { createGalleryControls } from "./gallery-controls.js";
import { findGalleryExample, galleryExamples } from "./gallery-examples.js";
import {
  applyPlaygroundSettings,
  readPlaygroundSettings,
  writePlaygroundSettings,
  type PlaygroundSettings
} from "./gallery-playground.js";
import type {
  ExampleGroup,
  ExampleSupport,
  GalleryExample
} from "./gallery-types.js";

interface PreviewReadyMessage {
  readonly type: "paged-example-ready";
  readonly token: number;
  readonly htmlPageCount: number;
  readonly pdfPageCount: number;
  readonly pdfBytes: Uint8Array;
}

interface PreviewProgressMessage {
  readonly type: "paged-example-progress";
  readonly token: number;
  readonly phase: string;
  readonly page?: number;
  readonly totalPages?: number;
}

interface PreviewErrorMessage {
  readonly type: "paged-example-error";
  readonly token: number;
  readonly message: string;
}

interface PreviewFrameReadyMessage {
  readonly type: "paged-preview-frame-ready";
}

type PreviewMessage =
  | PreviewErrorMessage
  | PreviewFrameReadyMessage
  | PreviewProgressMessage
  | PreviewReadyMessage;

interface PreviewRequest {
  readonly resolve: (message: PreviewReadyMessage) => void;
  readonly reject: (error: Error) => void;
}

const FRAME_TIMEOUT_MS = 10_000;
const PREVIEW_TIMEOUT_MS = 60_000;
const CONTROL_DEBOUNCE_MS = 300;
const supportLabels: Readonly<Record<ExampleSupport, string>> = {
  match: "Close match",
  partial: "Partial",
  "pagedjs-only": "Paged.js only"
};

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Gallery element is missing: ${selector}`);
  }
  return element;
}

function pageLabel(count: number): string {
  return `${count} ${count === 1 ? "page" : "pages"}`;
}

const navigation = requireElement<HTMLElement>("#example-navigation");
const exampleTitle = requireElement<HTMLElement>("#example-title");
const exampleSummary = requireElement<HTMLElement>("#example-summary");
const exampleSupport = requireElement<HTMLElement>("#example-support");
const exampleIndex = requireElement<HTMLElement>("#example-index");
const featureTags = requireElement<HTMLUListElement>("#feature-tags");
const compareNotes = requireElement<HTMLUListElement>("#compare-notes");
const htmlSource = requireElement<HTMLElement>("#html-source");
const cssSource = requireElement<HTMLElement>("#css-source");
const sourcePreview = requireElement<HTMLIFrameElement>("#source-preview");
const pagedPreview = requireElement<HTMLIFrameElement>("#paged-preview");
const pagedPreviewStatus = requireElement<HTMLElement>(
  "#paged-preview-status"
);
const pdfPreview = requireElement<HTMLIFrameElement>("#pdf-preview");
const pdfPlaceholder = requireElement<HTMLElement>("#pdf-placeholder");
const pdfMeta = requireElement<HTMLElement>("#pdf-meta");
const status = requireElement<HTMLElement>("#status");
const errorMessage = requireElement<HTMLElement>("#error");
const rerunButton = requireElement<HTMLButtonElement>("#rerun-button");
const downloadButton = requireElement<HTMLButtonElement>("#download-button");
const proofGrid = requireElement<HTMLElement>(".proof-grid");
const sourceTabs = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-source-tab]")
);

const previewRequests = new Map<number, PreviewRequest>();
let selectedExample: GalleryExample = galleryExamples[0];
let playgroundSettings: PlaygroundSettings = readPlaygroundSettings(
  window.location.search
);
let activeController: AbortController | undefined;
let activeToken = 0;
let currentResult: PdfResult | undefined;
let currentPdfUrl: string | undefined;
let controlRenderTimer: ReturnType<typeof setTimeout> | undefined;

function supportClass(support: ExampleSupport): string {
  return `support support-${support}`;
}

function effectiveExample(example: GalleryExample): GalleryExample {
  return applyPlaygroundSettings(example, playgroundSettings);
}

function buildNavigation(): void {
  const groups = new Map<ExampleGroup, GalleryExample[]>();
  for (const example of galleryExamples) {
    groups.set(example.group, [...(groups.get(example.group) ?? []), example]);
  }

  const fragment = document.createDocumentFragment();
  for (const [group, examples] of groups) {
    const section = document.createElement("section");
    section.className = "example-group";
    const heading = document.createElement("h2");
    heading.textContent = group;
    const list = document.createElement("ul");
    list.className = "example-list";

    for (const example of examples) {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.className = "example-link";
      link.href = `#/examples/${example.id}`;
      link.dataset.exampleId = example.id;
      link.dataset.testid = "example-link";
      const title = document.createElement("strong");
      title.textContent = example.shortTitle;
      const support = document.createElement("small");
      support.textContent = supportLabels[example.support];
      link.append(title, support);
      item.append(link);
      list.append(item);
    }
    section.append(heading, list);
    fragment.append(section);
  }
  navigation.replaceChildren(fragment);
}

function clearPdf(): void {
  if (currentPdfUrl !== undefined) {
    URL.revokeObjectURL(currentPdfUrl);
    currentPdfUrl = undefined;
  }
  currentResult = undefined;
  pdfPreview.removeAttribute("src");
  pdfPreview.hidden = true;
  pdfPlaceholder.hidden = false;
  pdfMeta.textContent = "Waiting";
  downloadButton.disabled = true;
}

function sourceDocument(example: GalleryExample): string {
  const safeCss = example.css.replaceAll("</style", "<\\/style");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; base-uri 'none'; form-action 'none'"
    >
    <style>${safeCss}</style>
    <style>
      html { min-height: 100%; padding: 1px; background: #dbe3e4; }
      body {
        width: min(210mm, calc(100% - 24px)) !important;
        min-height: calc(100vh - 48px);
        margin: 24px auto !important;
        padding: 16mm !important;
        background: white;
        box-shadow: 0 12px 32px rgb(24 47 57 / 18%);
      }
    </style>
  </head>
  <body>${example.html}</body>
</html>`;
}

function updateSource(example: GalleryExample): void {
  const effective = effectiveExample(example);
  htmlSource.textContent = effective.html;
  cssSource.textContent = effective.css;
  sourcePreview.srcdoc = sourceDocument(effective);
}

function updateExampleDetails(example: GalleryExample): void {
  const number = galleryExamples.indexOf(example) + 1;
  exampleTitle.textContent = example.title;
  exampleSummary.textContent = example.summary;
  exampleSupport.className = supportClass(example.support);
  exampleSupport.textContent = supportLabels[example.support];
  exampleIndex.textContent = `${String(number).padStart(2, "0")} / ${galleryExamples.length}`;
  updateSource(example);
  featureTags.replaceChildren(
    ...example.features.map((feature) => {
      const item = document.createElement("li");
      item.textContent = feature;
      return item;
    })
  );
  compareNotes.replaceChildren(
    ...example.compareNotes.map((note) => {
      const item = document.createElement("li");
      item.textContent = note;
      return item;
    })
  );

  for (const link of navigation.querySelectorAll<HTMLAnchorElement>(
    "[data-example-id]"
  )) {
    if (link.dataset.exampleId === example.id) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  }
}

function selectedIdFromHash(): string | undefined {
  return /^#\/examples\/([a-z0-9-]+)$/u.exec(window.location.hash)?.[1];
}

async function waitForPreviewFrame(signal: AbortSignal): Promise<void> {
  if (pagedPreview.contentDocument?.readyState === "complete") {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeoutId);
      pagedPreview.removeEventListener("load", handleLoad);
      pagedPreview.removeEventListener("error", handleError);
      signal.removeEventListener("abort", handleAbort);
    };
    const handleLoad = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("The Paged.js preview frame failed to load."));
    };
    const handleAbort = () => {
      cleanup();
      reject(new DOMException("The operation was aborted.", "AbortError"));
    };
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("The Paged.js preview frame timed out."));
    }, FRAME_TIMEOUT_MS);

    pagedPreview.addEventListener("load", handleLoad, { once: true });
    pagedPreview.addEventListener("error", handleError, { once: true });
    signal.addEventListener("abort", handleAbort, { once: true });
  });
}

function cancelChildPreview(token: number): void {
  pagedPreview.contentWindow?.postMessage(
    { type: "cancel-paged-example", token },
    window.location.origin
  );
}

async function requestPagedPreview(
  example: GalleryExample,
  token: number,
  signal: AbortSignal
): Promise<PreviewReadyMessage> {
  await waitForPreviewFrame(signal);
  if (signal.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }

  return await new Promise<PreviewReadyMessage>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeoutId);
      signal.removeEventListener("abort", handleAbort);
    };
    const rejectRequest = (error: Error) => {
      previewRequests.delete(token);
      cleanup();
      cancelChildPreview(token);
      reject(error);
    };
    const handleAbort = () => {
      rejectRequest(new DOMException("The operation was aborted.", "AbortError"));
    };
    const timeoutId = setTimeout(() => {
      rejectRequest(new Error("Paged.js preview generation timed out."));
    }, PREVIEW_TIMEOUT_MS);

    previewRequests.set(token, {
      resolve: (message) => {
        cleanup();
        resolve(message);
      },
      reject: (error) => {
        cleanup();
        reject(error);
      }
    });
    signal.addEventListener("abort", handleAbort, { once: true });
    pagedPreview.contentWindow?.postMessage(
      {
        type: "render-paged-example",
        token,
        html: example.html,
        css: example.css,
        title: example.title
      },
      window.location.origin
    );
  });
}

function showError(error: unknown): void {
  errorMessage.textContent =
    error instanceof Error ? error.message : "Unable to render this example.";
  errorMessage.hidden = false;
  status.textContent = "Proof failed";
  pagedPreviewStatus.textContent = "Error";
}

function handleProgress(message: PreviewProgressMessage): void {
  if (message.phase === "render" && message.page !== undefined) {
    status.textContent = `Translating page ${message.page} of ${message.totalPages ?? "?"}`;
  } else if (message.phase === "write") {
    status.textContent = "Writing PDF...";
  }
}

async function renderSelectedExample(): Promise<void> {
  if (controlRenderTimer !== undefined) {
    clearTimeout(controlRenderTimer);
    controlRenderTimer = undefined;
  }
  activeController?.abort();
  const controller = new AbortController();
  activeController = controller;
  activeToken += 1;
  const token = activeToken;

  clearPdf();
  errorMessage.hidden = true;
  rerunButton.disabled = true;
  status.textContent = "Paginating HTML...";
  pagedPreviewStatus.textContent = "Paginating...";

  try {
    const previewResult = await requestPagedPreview(
      effectiveExample(selectedExample),
      token,
      controller.signal
    );
    if (token !== activeToken) {
      return;
    }

    const bytes = Uint8Array.from(previewResult.pdfBytes);
    const result: PdfResult = {
      bytes,
      pageCount: previewResult.pdfPageCount,
      blob: new Blob([bytes], { type: "application/pdf" })
    };
    currentResult = result;
    currentPdfUrl = URL.createObjectURL(result.blob);
    pdfPreview.src = currentPdfUrl;
    pdfPreview.hidden = false;
    pdfPlaceholder.hidden = true;
    downloadButton.disabled = false;

    const sizeKb = Math.ceil(result.bytes.byteLength / 1024);
    pagedPreviewStatus.textContent = pageLabel(previewResult.htmlPageCount);
    pdfMeta.textContent = `${pageLabel(result.pageCount)} / ${sizeKb} KB`;
    status.textContent = `${pageLabel(result.pageCount)} / ${sizeKb} KB`;
    pagedPreview.contentWindow?.postMessage(
      { type: "scale-paged-example", token },
      window.location.origin
    );
  } catch (error) {
    if (
      controller.signal.aborted ||
      (error instanceof DOMException && error.name === "AbortError")
    ) {
      return;
    }
    showError(error);
  } finally {
    if (token === activeToken) {
      rerunButton.disabled = false;
    }
  }
}

function selectFromLocation(): void {
  if (controlRenderTimer !== undefined) {
    clearTimeout(controlRenderTimer);
    controlRenderTimer = undefined;
  }
  const requestedId = selectedIdFromHash();
  const nextExample = findGalleryExample(requestedId);
  if (requestedId !== nextExample.id) {
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}#/examples/${nextExample.id}`
    );
  }
  selectedExample = nextExample;
  updateExampleDetails(nextExample);
  void renderSelectedExample();
}

function writeSettingsToLocation(): void {
  const search = writePlaygroundSettings(playgroundSettings);
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${search}${window.location.hash}`
  );
}

function handlePlaygroundInput(settings: PlaygroundSettings): void {
  playgroundSettings = { ...settings };
  writeSettingsToLocation();
  activeController?.abort();
  clearPdf();
  updateSource(selectedExample);
  status.textContent = "Changes pending...";
  pagedPreviewStatus.textContent = "Updating...";
  errorMessage.hidden = true;
  rerunButton.disabled = true;
  if (controlRenderTimer !== undefined) {
    clearTimeout(controlRenderTimer);
  }
  controlRenderTimer = setTimeout(() => {
    controlRenderTimer = undefined;
    void renderSelectedExample();
  }, CONTROL_DEBOUNCE_MS);
}

window.addEventListener("message", (event: MessageEvent<PreviewMessage>) => {
  if (
    event.origin !== window.location.origin ||
    event.source !== pagedPreview.contentWindow
  ) {
    return;
  }
  if (event.data.type === "paged-preview-frame-ready") {
    return;
  }

  const request = previewRequests.get(event.data.token);
  if (request === undefined) {
    return;
  }
  if (event.data.type === "paged-example-progress") {
    handleProgress(event.data);
    return;
  }

  previewRequests.delete(event.data.token);
  if (event.data.type === "paged-example-ready") {
    request.resolve(event.data);
  } else {
    request.reject(new Error(event.data.message));
  }
});

function activateSourceTab(tab: HTMLButtonElement, focus: boolean): void {
  const selectedTab = tab.dataset.sourceTab;
  for (const candidate of sourceTabs) {
    const isSelected = candidate === tab;
    candidate.setAttribute("aria-selected", String(isSelected));
    candidate.tabIndex = isSelected ? 0 : -1;
  }
  for (const panel of ["rendered", "html", "css"]) {
    requireElement<HTMLElement>(`#${panel}-panel`).hidden =
      panel !== selectedTab;
  }
  if (focus) {
    tab.focus();
  }
}

for (const [index, tab] of sourceTabs.entries()) {
  tab.tabIndex = tab.getAttribute("aria-selected") === "true" ? 0 : -1;
  tab.addEventListener("click", () => activateSourceTab(tab, false));
  tab.addEventListener("keydown", (event) => {
    let nextIndex: number | undefined;
    if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = sourceTabs.length - 1;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + sourceTabs.length) % sourceTabs.length;
    } else if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % sourceTabs.length;
    }
    if (nextIndex !== undefined) {
      event.preventDefault();
      const nextTab = sourceTabs[nextIndex];
      if (nextTab !== undefined) {
        activateSourceTab(nextTab, true);
      }
    }
  });
}

const galleryControls = createGalleryControls(
  proofGrid,
  playgroundSettings,
  handlePlaygroundInput
);

rerunButton.addEventListener("click", () => {
  void renderSelectedExample();
});

downloadButton.addEventListener("click", () => {
  if (currentResult !== undefined) {
    downloadPdf(currentResult.blob, `${selectedExample.id}.pdf`);
  }
});

window.addEventListener("hashchange", selectFromLocation);
window.addEventListener("popstate", () => {
  playgroundSettings = readPlaygroundSettings(window.location.search);
  galleryControls.update(playgroundSettings);
  selectFromLocation();
});
window.addEventListener("beforeunload", () => {
  if (controlRenderTimer !== undefined) {
    clearTimeout(controlRenderTimer);
  }
  activeController?.abort();
  clearPdf();
});

buildNavigation();
selectFromLocation();
