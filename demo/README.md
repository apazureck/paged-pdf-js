# Local demos

Start the Vite development server:

```bash
npm run demo
```

Then open:

- `http://127.0.0.1:5173/` for the editable HTML/CSS playground.
- `http://127.0.0.1:5173/gallery.html` for the Paged.js feature lab.

The feature lab keeps three synchronized views for each catalog entry:

1. the continuous source document, with rendered, HTML, and CSS tabs;
2. the Paged.js page DOM;
3. the PDF authored from that exact page DOM with jsPDF primitives.

The “Tune this proof” controls adjust page margin, body text, line height,
paragraph spacing, and heading size. Changes update the effective CSS
immediately and regenerate the Paged.js and PDF panes after a short debounce.
Values are stored in the URL query string, so a tuned proof can be reloaded or
shared together with its `#/examples/<example-id>` deep link.

The support badge and comparison notes call out places where browser-generated
content is intentionally not reproduced by the bounded PDF renderer.

No gallery path uses screenshots, `html2canvas`, or `jsPDF.html()`.
