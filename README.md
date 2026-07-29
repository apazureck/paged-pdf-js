# paged-pdf-js

Convert HTML into paged, vector-oriented PDFs entirely in the browser.
`paged-pdf-js` uses [Paged.js](https://pagedjs.org/) for CSS Paged Media
layout, reads the geometry of the resulting page DOM, and writes PDF drawing
primitives with [jsPDF](https://github.com/parallax/jsPDF).

The authoring path does not take page screenshots, use html2canvas, or call
`jsPDF.html()`. Text is written as PDF text and is therefore selectable and
searchable.

[Try the demo](https://pagedpdf.pazureck.de) |
[Report an issue](https://github.com/apazureck/paged-pdf-js/issues)

## How it works

```text
HTML + paged-media CSS
        |
Paged.js page DOM
        |
immutable drawing commands
        |
jsPDF text, rectangles, images, and link annotations
        |
PDF bytes + Blob
```

Mozilla PDF.js is a PDF parser and viewer, not an authoring library. This
project uses jsPDF to create files and PDF.js as an independent validator in
its tests.

## Install

```bash
npm install paged-pdf-js
```

Conversion requires a browser DOM. The package can be installed through npm
and used by browser bundlers; importing it does not access the DOM or upload
content.

```ts
import { downloadPdf, htmlToPdf } from "paged-pdf-js";

const result = await htmlToPdf(
  `
    <article>
      <h1>Hello, paged world</h1>
      <p>This text remains selectable in the PDF.</p>
    </article>
  `,
  {
    styleText: `
      @page {
        size: A4;
        margin: 20mm;

        @bottom-center {
          content: counter(page) " / " counter(pages);
        }
      }

      article {
        border-left: 4px solid #0b7189;
        background: #edf6f7;
        padding: 16px;
      }
    `,
    metadata: {
      title: "Hello, paged world",
      author: "Example author"
    }
  }
);

downloadPdf(result.blob, "hello.pdf");
```

### UNPKG

The standalone UMD build exposes `window.PagedPdf`:

```html
<script src="https://unpkg.com/paged-pdf-js@0.1.0/dist/paged-pdf.min.js"></script>
<script>
  PagedPdf.htmlToPdf("<h1>Hello</h1>", {
    styleText: "@page { size: A4; margin: 20mm; }"
  }).then((result) => {
    PagedPdf.downloadPdf(result.blob, "hello.pdf");
  });
</script>
```

Pin an exact version in production.

## API

### `htmlToPdf(input, options?)`

Paginates a string, `Element`, or `DocumentFragment` in a temporary Shadow DOM
boundary. Caller-owned DOM is cloned and never mutated.

```ts
interface PdfResult {
  readonly bytes: Uint8Array;
  readonly pageCount: number;
  readonly blob: Blob;
}
```

### `pagedDomToPdf(root, options?)`

Converts an existing trusted Paged.js preview containing `.pagedjs_page`
elements. This lower-level API assumes your application has already sanitized
the DOM and constrained resource URLs.

### `downloadPdf(bytesOrBlob, filename?)`

Starts a browser download and revokes its temporary object URL.

### Options

```ts
interface HtmlToPdfOptions {
  readonly styleText?: string;
  readonly baseUrl?: string;
  readonly allowedResourceOrigins?: readonly string[];
  readonly metadata?: {
    readonly title?: string;
    readonly author?: string;
    readonly subject?: string;
    readonly keywords?: readonly string[];
  };
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: {
    readonly phase: "paginate" | "assets" | "render" | "write";
    readonly page?: number;
    readonly totalPages?: number;
  }) => void;
}
```

Resource URLs are same-origin by default. Add trusted origins explicitly for
PNG/JPEG `<img src>` resources:

```ts
await htmlToPdf(html, {
  baseUrl: "https://documents.example.com/report/",
  allowedResourceOrigins: [
    "https://documents.example.com",
    "https://cdn.example.com"
  ]
});
```

External stylesheets, CSS `@import`, CSS resource URLs, and `srcset` loading are
not supported. Pass self-contained CSS through `styleText`. Errors are
`PagedPdfError` instances with stable `code` values.

## Rendering support

The initial primitive renderer deliberately supports a bounded subset:

| Feature | v0.1 behavior |
|---|---|
| Paged.js page count and dimensions | Supported |
| Visible left-to-right text | Selectable PDF text |
| Font size, color, bold, italic | Supported |
| Font families | Mapped to Helvetica, Times, or Courier |
| Solid background colors | Supported |
| Per-side solid borders | Supported |
| PNG and JPEG `<img src>` elements | Validated original bytes embedded directly |
| External HTTP(S), mail, and telephone links | PDF link annotations |
| Forced page breaks, counters, margin content | Laid out by Paged.js |

The following are not yet reproduced:

- gradients, background images, shadows, filters, blend modes, and opacity;
- border radius, dashed/dotted borders, and complex table-border resolution;
- transforms, CSS stacking contexts, masks, and non-rectangular clipping;
- SVG drawing, canvas, video, GIF, WebP, AVIF, or responsive `srcset`;
- custom web-font embedding, complex-script shaping, bidi, or vertical text;
- exact browser font metrics, kerning, letter spacing, and ligatures;
- tagged-PDF structure or PDF accessibility semantics.

The renderer uses the positions established by Paged.js, but unsupported visual
effects are omitted. It does not silently fall back to a screenshot.

## Security and privacy

Conversion happens locally. String/element input is cloned into a temporary
Shadow DOM boundary. The high-level API removes scripts, frames, embeds,
objects, templates, event handlers, `srcdoc`, custom elements, active SVG
animation, unsafe resource attributes, and URL-bearing CSS.

Remote PNG/JPEG images must pass the origin policy, are fetched with redirects
disabled before entering the render DOM, and are replaced with temporary local
blob URLs. Their byte signatures and dimensions are validated before jsPDF
receives them. Cross-origin images require suitable CORS headers.

This reduces active-content risk but is not a replacement for a maintained
application-level HTML sanitizer. Treat input as trusted whenever possible.

Conversions time out after 60 seconds and enforce limits on input size, DOM
elements, page dimensions, pages, drawing commands, image count, image bytes,
image pixels, and PDF output. Expensive DOM translation periodically yields so
abort and timeout signals can be observed.

## Development

Requires Node.js 20.19 or later; CI and release jobs use Node.js 24.

```bash
npm install
npx playwright install chromium
npm run validate
```

Validation runs linting, strict TypeScript checks, coverage, production builds,
Chromium E2E tests, PDF.js parsing/text extraction, no-canvas authoring tests,
redirect-boundary tests, and npm package-content checks. Coverage must remain
at least 80%.

## Release and deployment

- Publishing a GitHub Release whose tag matches `v<package.version>` runs the
  npm release workflow with provenance.
- A successful `main` CI run triggers the protected static-demo deployment
  workflow for `pagedpdf.pazureck.de`.
- UNPKG serves the npm package automatically; no separate upload is needed.

## License

[MIT](LICENSE)
