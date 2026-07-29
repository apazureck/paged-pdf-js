import { downloadPdf, htmlToPdf, type PdfResult } from "../src/index.js";

const SAMPLE_HTML = `<article>
  <p class="kicker">A browser-native publishing experiment</p>
  <h1>The shape of a printed page</h1>
  <p class="lede">
    Paged media turns a continuous document into deliberate, finite pages.
    Running headers, counters, margins, and controlled breaks are all part of
    the layout.
  </p>
  <div class="rule"></div>
  <h2>First principles</h2>
  <p>
    This demo sends your HTML through Paged.js, translates the generated page
    DOM into PDF drawing commands, and writes a PDF without uploading your
    content to a server.
  </p>
  <p>Learn more from the <a href="https://pagedjs.org/">Paged.js project</a>.</p>
  <blockquote>
    “The page is not just a container. It is part of the composition.”
  </blockquote>
</article>

<article class="chapter-break">
  <p class="kicker">Chapter two</p>
  <h1>Designed for the browser</h1>
  <p class="lede">
    The generated file has the same page count and physical dimensions as the
    Paged.js layout, while ordinary text stays selectable.
  </p>
  <ul>
    <li>Client-side and private by default</li>
    <li>Installable from npm</li>
    <li>Usable directly from UNPKG</li>
  </ul>
  <p class="closing">Edit this sample and make it yours.</p>
</article>`;

const SAMPLE_CSS = `@page {
  size: A4;
  margin: 22mm 20mm 24mm;

  @top-left {
    content: "paged-pdf-js";
    color: #53636f;
    font: 600 9pt system-ui;
    letter-spacing: 0.08em;
  }

  @bottom-right {
    content: counter(page) " / " counter(pages);
    color: #53636f;
    font: 9pt system-ui;
  }
}

* { box-sizing: border-box; }
body {
  color: #16242c;
  font: 12pt/1.6 Georgia, serif;
}
h1 {
  margin: 0 0 8mm;
  color: #102f3d;
  font: 700 30pt/1.05 Georgia, serif;
}
h2 {
  margin-top: 12mm;
  color: #0b7189;
  font: 700 15pt/1.2 system-ui;
}
a { color: #0b7189; }
.kicker {
  margin: 0 0 5mm;
  color: #e55336;
  font: 700 9pt system-ui;
  text-transform: uppercase;
}
.lede { color: #40515a; font-size: 15pt; }
.rule { width: 24mm; height: 2mm; margin: 12mm 0; background: #f0ad4e; }
blockquote {
  margin: 14mm 0 0;
  padding: 8mm;
  border-left: 2mm solid #0b7189;
  background: #edf6f7;
  color: #174754;
  font-size: 16pt;
}
.chapter-break { break-before: page; }
li { margin-bottom: 4mm; }
.closing {
  margin-top: 18mm;
  padding: 8mm;
  background: #102f3d;
  color: white;
  font: 700 14pt system-ui;
}`;

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Demo element is missing: ${selector}`);
  }
  return element;
}

const htmlInput = requireElement<HTMLTextAreaElement>("#html-input");
const cssInput = requireElement<HTMLTextAreaElement>("#css-input");
const generateButton = requireElement<HTMLButtonElement>("#generate-button");
const downloadButton = requireElement<HTMLButtonElement>("#download-button");
const status = requireElement<HTMLElement>("#status");
const errorMessage = requireElement<HTMLElement>("#error");
const preview = requireElement<HTMLIFrameElement>("#pdf-preview");
const placeholder = requireElement<HTMLElement>("#preview-placeholder");

htmlInput.value = SAMPLE_HTML;
cssInput.value = SAMPLE_CSS;

let currentResult: PdfResult | undefined;
let currentPreviewUrl: string | undefined;

function clearPreviewUrl(): void {
  if (currentPreviewUrl !== undefined) {
    URL.revokeObjectURL(currentPreviewUrl);
    currentPreviewUrl = undefined;
  }
}

function showError(error: unknown): void {
  const message =
    error instanceof Error ? error.message : "PDF generation failed.";
  errorMessage.textContent = message;
  errorMessage.hidden = false;
  status.textContent = "Generation failed";
}

async function generatePdf(): Promise<void> {
  generateButton.disabled = true;
  downloadButton.disabled = true;
  errorMessage.hidden = true;
  status.textContent = "Preparing document…";

  try {
    const result = await htmlToPdf(htmlInput.value, {
      styleText: cssInput.value,
      baseUrl: document.location.href,
      metadata: {
        title: "paged-pdf-js demo",
        author: "paged-pdf-js"
      },
      onProgress: ({ phase, page, totalPages }) => {
        if (phase === "render" && page !== undefined) {
          status.textContent = `Translating page ${page} of ${totalPages ?? "…"}`;
          return;
        }
        status.textContent =
          phase === "paginate" ? "Paginating…" : "Writing PDF…";
      }
    });

    clearPreviewUrl();
    currentResult = result;
    currentPreviewUrl = URL.createObjectURL(result.blob);
    preview.src = currentPreviewUrl;
    preview.hidden = false;
    placeholder.hidden = true;
    downloadButton.disabled = false;
    const pageLabel = result.pageCount === 1 ? "page" : "pages";
    status.textContent = `${result.pageCount} ${pageLabel} · ${Math.ceil(
      result.bytes.byteLength / 1024
    )} KB`;
  } catch (error) {
    currentResult = undefined;
    showError(error);
  } finally {
    generateButton.disabled = false;
  }
}

generateButton.addEventListener("click", () => {
  void generatePdf();
});

downloadButton.addEventListener("click", () => {
  if (currentResult !== undefined) {
    downloadPdf(currentResult.blob, "paged-pdf-demo.pdf");
  }
});

window.addEventListener("beforeunload", clearPreviewUrl);
