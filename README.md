# paged-pdf-js

Convert HTML into paged PDFs entirely in the browser. `paged-pdf-js` uses
[Paged.js](https://pagedjs.org/) for CSS Paged Media layout, captures each
generated page, and uses [pdf-lib](https://pdf-lib.js.org/) to author the final
PDF.

[Try the demo](https://pagedpdf.pazureck.de) ·
[Report an issue](https://github.com/apazureck/paged-pdf-js/issues)

## Why not PDF.js?

[Mozilla PDF.js](https://mozilla.github.io/pdf.js/) is a PDF parser and
renderer. It does not expose a supported PDF-authoring API. This project uses
`pdf-lib` to create PDF files and PDF.js as an independent validator in its
test suite.

## Install

```bash
npm install paged-pdf-js
```

`paged-pdf-js` is browser-only at conversion time. It can be installed through
npm and imported by browser bundlers; importing the package does not access the
DOM, start a conversion, or upload content.

```ts
import { downloadPdf, htmlToPdf } from "paged-pdf-js";

const result = await htmlToPdf(
  `
    <article>
      <h1>Hello, paged world</h1>
      <p>This document is generated in the browser.</p>
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
    `,
    metadata: {
      title: "Hello, paged world",
      author: "Example author"
    }
  }
);

console.log(result.pageCount);
downloadPdf(result.blob, "hello.pdf");
```

### UNPKG

The standalone UMD build exposes `window.PagedPdf`:

```html
<script src="https://unpkg.com/paged-pdf-js@0.1.0/dist/paged-pdf.min.js"></script>
<script>
  (async () => {
    const result = await PagedPdf.htmlToPdf("<h1>Hello</h1>", {
      styleText: "@page { size: A4; margin: 20mm; }"
    });

    PagedPdf.downloadPdf(result.blob, "hello.pdf");
  })().catch(console.error);
</script>
```

Pin an exact version in production.

## API

### `htmlToPdf(input, options?)`

Paginates a string, `Element`, or `DocumentFragment` in a temporary Shadow DOM
boundary and returns:

```ts
interface PdfResult {
  readonly bytes: Uint8Array;
  readonly pageCount: number;
  readonly blob: Blob;
}
```

The caller-owned DOM is cloned and never mutated.

### `pagedDomToPdf(root, options?)`

Converts an existing Paged.js preview containing `.pagedjs_page` elements.
Use this when your application already manages pagination.

### `downloadPdf(bytesOrBlob, filename?)`

Starts a browser download and revokes its temporary object URL.

### Options

```ts
interface HtmlToPdfOptions {
  readonly styleText?: string;
  readonly baseUrl?: string;
  readonly allowedResourceOrigins?: readonly string[];
  readonly pixelRatio?: number; // default 2, maximum 4
  readonly imageFormat?: "png" | "jpeg"; // default "png"
  readonly jpegQuality?: number; // > 0 and <= 1
  readonly backgroundColor?: string | null;
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

Resource URLs are same-origin by default. Add trusted origins explicitly:

```ts
await htmlToPdf(html, {
  baseUrl: "https://documents.example.com/report/",
  allowedResourceOrigins: [
    "https://documents.example.com",
    "https://cdn.example.com"
  ]
});
```

Pass CSS through `styleText`. External stylesheet URLs and CSS `@import` are
rejected so every CSS resource URL can be parsed and checked against the same
origin policy.

Errors are instances of `PagedPdfError` with a stable `code`.

## Security and privacy

Conversion happens locally in the browser. Input is cloned into a temporary
Shadow DOM boundary. The library removes scripts, frames, embeds, objects,
styles, templates, event handlers, `srcdoc`, customized built-ins, and custom
elements. It resolves and validates resource URLs after applying `baseUrl`;
only same-origin resources, allowlisted origins, and raster data images are
accepted. CSS is parsed as an AST; imports, unparsed raw syntax, and disallowed
URLs are rejected.

The preparation step reduces active-content risk, but it is not a replacement
for an application-level, maintained HTML sanitizer. Treat input HTML and CSS
as trusted whenever possible. External resources can still make requests to
origins you explicitly allow, and cross-origin images need suitable CORS
headers for canvas capture.

Conversions are cancelled after 60 seconds and enforce fixed limits of 50,000
DOM elements, 100 pages, 40 million capture pixels per page, 200 million total
capture pixels, and 100 MB of PDF output.

## Current limitations

- Version 0.1 rasterizes each page for broad CSS fidelity. Text is not
  selectable, searchable, or tagged for accessibility.
- Conversion requires a browser DOM. Server-side Node.js conversion is not
  included.
- Large documents and high `pixelRatio` values use significant memory.
- Paged.js support determines which CSS Paged Media features are available.
- Cross-origin fonts and images must be allowlisted and permit browser access.

A vector renderer can be added behind the same public API in a future release.

## Development

Requires Node.js 20.19 or later; Node.js 24 is used in CI and release jobs.

```bash
npm install
npx playwright install chromium
npm run validate
```

The validation gate runs linting, strict TypeScript checks, unit/integration
coverage, production builds, Chromium E2E tests, and package-content checks.
The suite enforces at least 80% coverage.

## Release and deployment

- Publishing a GitHub Release whose tag exactly matches `v<package.version>`
  runs `.github/workflows/release.yml` and publishes the tested package with
  npm provenance. Configure npm trusted publishing for
  `apazureck/paged-pdf-js` and protect the `npm` GitHub environment first.
- A successful `main` CI run triggers `.github/workflows/deploy.yml`. Configure
  the protected `production` environment secrets `DEPLOY_SSH_KEY`,
  `DEPLOY_KNOWN_HOSTS`, `DEPLOY_HOST`, `DEPLOY_USER`, and `DEPLOY_PATH`.
  Deployment uses immutable releases, an atomic symlink, a live asset smoke
  test, and rollback on failure.
- UNPKG automatically serves files from the published npm package; no separate
  UNPKG upload is required.

## License

[MIT](LICENSE)
