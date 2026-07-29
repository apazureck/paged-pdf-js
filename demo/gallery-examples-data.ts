import type { GalleryExample } from "./gallery-types.js";

const baseCss = `
* { box-sizing: border-box; }
body { margin: 0; color: #172b35; font: 11pt/1.5 Georgia, serif; }
h1, h2 { color: #123f50; font-family: Arial, sans-serif; }
h1 { font-size: 25pt; line-height: 1.05; }
p { margin: 0 0 4mm; }
.eyebrow { color: #c9472d; font: 700 8pt Arial; letter-spacing: .12em; text-transform: uppercase; }
`;

const prose = `<p>Paged media turns a continuous document into finite sheets with edges,
margins, and a deliberate reading rhythm.</p><p>Paged.js establishes each
fragment before the PDF writer translates the geometry into selectable text
and vector shapes.</p>`;

const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

export const galleryExamples = [
  {
    id: "page-size",
    group: "Page construction",
    title: "Page size & margin boxes",
    shortTitle: "Page size & margins",
    summary: "A5 dimensions, physical margins, running labels, and counters.",
    support: "partial",
    features: ["@page size", "margins", "margin boxes", "page counters"],
    compareNotes: [
      "Physical page dimensions and content geometry should match closely.",
      "Generated margin counters can be simplified in the primitive PDF."
    ],
    html: `<article><p class="eyebrow">Page construction / 01</p><h1>A small field guide</h1><p class="lede">A compact sheet with reserved running information.</p><div class="specimen"><strong>148 x 210 mm</strong><span>18 mm margins</span></div>${prose}</article>`,
    css: `@page { size: A5 portrait; margin: 18mm; @top-left { content: "PAGED MEDIA FIELD NOTES"; font: 700 7pt Arial; } @bottom-right { content: counter(page) " / " counter(pages); font: 8pt Arial; } } ${baseCss} .lede { color: #536871; font-size: 14pt; } .specimen { display: flex; margin: 10mm 0; padding: 8mm; flex-direction: column; border: 1.5mm solid #17748b; background: #e8f3f4; } .specimen strong { font: 700 20pt Arial; }`
  },
  {
    id: "fragmentation",
    group: "Fragmentation",
    title: "Breaks & fragmentation",
    shortTitle: "Breaks & fragments",
    summary: "Forced transitions, protected boxes, widows, and orphans.",
    support: "match",
    features: ["break-before", "break-inside", "widows", "orphans"],
    compareNotes: [
      "Colored labels make forced page boundaries easy to compare.",
      "Paged.js fragment coordinates are reused by the PDF writer."
    ],
    html: `<section><p class="eyebrow">Fragmentation / 02</p><h1>Opening sequence</h1>${prose}<aside><strong>Keep this note together.</strong>${prose}</aside></section><section class="new-page"><p class="eyebrow">Forced page</p><h1>Second movement</h1>${prose}${prose}</section><section class="new-page"><h1>Closing page</h1>${prose}</section>`,
    css: `@page { size: A5; margin: 16mm; @bottom-center { content: counter(page); } } ${baseCss} section { widows: 3; orphans: 3; } .new-page { break-before: page; } aside { padding: 6mm; break-inside: avoid; border: 1mm solid #dd704f; background: #fff0e8; }`
  },
  {
    id: "named-pages",
    group: "Page construction",
    title: "Named pages & orientation",
    shortTitle: "Named pages",
    summary: "A portrait cover followed by a named landscape report.",
    support: "match",
    features: ["named @page", "page property", "portrait", "landscape"],
    compareNotes: [
      "The PDF preserves each generated page's dimensions.",
      "Compare the portrait cover with the landscape report."
    ],
    html: `<section class="cover"><p class="eyebrow">Named pages / 03</p><h1>Quarterly field report</h1><div class="cover-mark">Q3</div></section><section class="landscape-report"><p class="eyebrow">Landscape report</p><h1>Observations by region</h1><div class="metrics"><strong>24 sites</strong><strong>89% coverage</strong></div>${prose}${prose}</section>`,
    css: `@page cover { size: A5 portrait; margin: 18mm; background-color: #e8f3f4; } @page report { size: A4 landscape; margin: 18mm 22mm; } ${baseCss} .cover { page: cover; } .landscape-report { page: report; break-before: page; } .cover-mark { display: grid; width: 45mm; height: 45mm; margin-top: 22mm; place-items: center; border: 2mm solid #17748b; font: 700 34pt Arial; } .metrics { display: flex; gap: 8mm; margin: 9mm 0; } .metrics strong { padding: 6mm; border-top: 1.5mm solid #dd704f; background: #fff0e8; }`
  },
  {
    id: "columns",
    group: "Fragmentation",
    title: "Multi-column flow",
    shortTitle: "Columns",
    summary: "Browser columns fragmented into an editorial page.",
    support: "match",
    features: ["column-count", "column-gap", "fragment flow"],
    compareNotes: [
      "Every laid-out fragment remains selectable PDF text.",
      "Kerning and exact line endings can differ."
    ],
    html: `<article><p class="eyebrow">Fragmentation / 04</p><h1>Notes from the estuary</h1><div class="columns"><h2>A changing edge</h2>${prose}${prose}<aside>Columns are established before pagination.</aside><h2>Reading the water</h2>${prose}${prose}</div></article>`,
    css: `@page { size: A4; margin: 20mm; } ${baseCss} .columns { columns: 2; column-gap: 12mm; column-rule: 1px solid #b6c6ca; } .columns aside { margin: 6mm 0; padding: 5mm; break-inside: avoid; border: 1mm solid #17748b; background: #e8f3f4; font: 700 10pt Arial; }`
  },
  {
    id: "tables",
    group: "Rich content",
    title: "Repeated table headings",
    shortTitle: "Tables",
    summary: "A semantic table repeats its header across compact pages.",
    support: "match",
    features: ["repeated thead", "break-inside", "multi-page table"],
    compareNotes: [
      "Solid cell fills and borders are supported.",
      "Separate borders avoid collapsed-border conflict resolution."
    ],
    html: `<article><p class="eyebrow">Rich content / 05</p><h1>Survey register</h1><table><thead><tr><th>Station</th><th>Habitat</th><th>Index</th></tr></thead><tbody>${Array.from({ length: 24 }, (_, index) => `<tr><td>ST-${String(index + 1).padStart(2, "0")}</td><td>${["Salt marsh", "Mudflat", "Reed bed"][index % 3]}</td><td>${72 + (index % 19)}</td></tr>`).join("")}</tbody></table></article>`,
    css: `@page { size: A5; margin: 15mm; } ${baseCss} table { width: 100%; border-spacing: 2px; font: 9pt Arial; } thead { display: table-header-group; } tr { break-inside: avoid; } th, td { padding: 3mm; border: 1px solid #9eb1b7; text-align: left; } th { background: #123f50; color: white; } tbody tr:nth-child(even) td { background: #e8f3f4; }`
  },
  {
    id: "media-links",
    group: "Rich content",
    title: "Images & external links",
    shortTitle: "Images & links",
    summary: "Direct PNG embedding, image reuse, and PDF link annotations.",
    support: "match",
    features: ["PNG", "image reuse", "HTTP link", "mailto link"],
    compareNotes: [
      "Original PNG bytes are embedded without a canvas.",
      "External links work; internal PDF destinations are not implemented yet."
    ],
    html: `<article><p class="eyebrow">Rich content / 06</p><h1>Field symbols</h1><div class="symbols"><figure><img src="${png}" alt="Raster specimen"><figcaption>Original bytes</figcaption></figure><figure><img src="${png}" alt="Repeated specimen"><figcaption>Reused alias</figcaption></figure></div><p><a href="https://pagedjs.org/">Paged.js documentation</a> / <a href="mailto:hello@example.com">Send a note</a></p></article>`,
    css: `@page { size: A5; margin: 17mm; } ${baseCss} .symbols { display: flex; gap: 8mm; margin: 12mm 0; } figure { width: 50%; margin: 0; padding: 6mm; border: 1mm solid #17748b; background: #e8f3f4; } img { display: block; width: 100%; height: 32mm; background: #dd704f; } figcaption { font: 700 8pt Arial; } a { color: #126c86; font-weight: 700; }`
  },
  {
    id: "running-content",
    group: "Generated content",
    title: "Running headers & counters",
    shortTitle: "Running content",
    summary: "Chapter strings are reused in left and right page margins.",
    support: "partial",
    features: ["string-set", "string()", ":left", ":right"],
    compareNotes: [
      "The HTML pane is authoritative for margin boxes.",
      "Generated running text and counters may be absent from the PDF."
    ],
    html: `<article><section class="chapter"><h1>Coast</h1>${prose}${prose}${prose}</section><section class="chapter"><h1>Forest</h1>${prose}${prose}${prose}</section><section class="chapter"><h1>High ground</h1>${prose}${prose}</section></article>`,
    css: `@page { size: A5; margin: 18mm 16mm 20mm; @bottom-center { content: counter(page) " of " counter(pages); } } @page :left { @top-left { content: string(chapter); } } @page :right { @top-right { content: string(chapter); } } ${baseCss} .chapter { break-before: page; } .chapter:first-child { break-before: auto; } .chapter h1 { string-set: chapter content(text); }`
  },
  {
    id: "footnotes",
    group: "Generated content",
    title: "Footnotes",
    shortTitle: "Footnotes",
    summary: "Paged.js moves note bodies and generates calls and markers.",
    support: "partial",
    features: ["float: footnote", "@footnote", "footnote call", "marker"],
    compareNotes: [
      "Moved footnote body text can translate.",
      "Generated calls, markers, and internal navigation are not guaranteed."
    ],
    html: `<article><p class="eyebrow">Generated content / 08</p><h1>Reading with notes</h1><p>Notes stay close to their claims.<span class="footnote">A footnote moves into the page footnote area.</span> Paged.js creates its call automatically.</p>${prose}<p>A second note is numbered automatically.<span class="footnote">Calls and markers are generated content.</span></p></article>`,
    css: `@page { size: A5; margin: 18mm 16mm 24mm; @footnote { float: bottom; border-top: 1px solid #17748b; padding-top: 3mm; } } ${baseCss} .footnote { float: footnote; color: #50656e; font: 8pt Arial; } ::footnote-call { content: counter(footnote); color: #c9472d; } ::footnote-marker { content: counter(footnote) ". "; color: #c9472d; }`
  },
  {
    id: "cross-references",
    group: "Generated content",
    title: "Generated content & cross-references",
    shortTitle: "Cross-references",
    summary: "Automatic figure labels and target page references.",
    support: "partial",
    features: ["CSS counters", "::before", "target-counter()", "target-text()"],
    compareNotes: [
      "Pseudo-element and target-counter output are strongest in HTML.",
      "The PDF translator currently reads ordinary DOM text nodes."
    ],
    html: `<nav class="toc"><p class="eyebrow">Generated content / 09</p><h1>Contents</h1><ol><li><a href="#first">First observation</a></li><li><a href="#second">Second observation</a></li></ol></nav><section id="first" class="entry"><h1>First observation</h1>${prose}<figure><div>A</div><figcaption>Sampling area</figcaption></figure></section><section id="second" class="entry"><h1>Second observation</h1>${prose}<figure><div>B</div><figcaption>Control area</figcaption></figure></section>`,
    css: `@page { size: A5; margin: 16mm; } ${baseCss} body { counter-reset: figure; } .toc { break-after: page; } .toc a::after { content: " - page " target-counter(attr(href), page); } .entry { break-before: page; } figure { counter-increment: figure; } figcaption::before { content: "Figure " counter(figure) ": "; font-weight: 700; } figure div { display: grid; height: 42mm; place-items: center; border: 1.5mm solid #17748b; background: #e8f3f4; font: 700 30pt Arial; }`
  },
  {
    id: "difference-lab",
    group: "Known differences",
    title: "Visual effects difference lab",
    shortTitle: "Difference lab",
    summary: "A stress sheet exposes unsupported CSS instead of hiding it.",
    support: "pagedjs-only",
    features: ["gradients", "shadows", "radius", "transforms", "SVG"],
    compareNotes: [
      "Gradients, shadows, transforms, SVG, radius, and dashed borders are outside v0.1.",
      "This sheet shows how the bounded primitive renderer degrades."
    ],
    html: `<article><p class="eyebrow">Known differences / 10</p><h1>Effects stress sheet</h1><div class="effects"><div class="gradient">Gradient</div><div class="shadow">Shadow</div><div class="rounded">Rounded</div><div class="dashed">Dashed</div><div class="rotated">Rotated</div><div class="faded">Opacity</div></div><svg viewBox="0 0 160 60" aria-label="Inline SVG wave"><path d="M0 35 Q40 5 80 35 T160 35" fill="none" stroke="#17748b" stroke-width="8"/></svg></article>`,
    css: `@page { size: A5; margin: 16mm; } ${baseCss} .effects { display: grid; margin-top: 8mm; grid-template-columns: 1fr 1fr; gap: 6mm; } .effects div { display: grid; min-height: 28mm; place-items: center; font: 700 11pt Arial; } .gradient { background: linear-gradient(135deg, #17748b, #f0ae4c); color: white; } .shadow { box-shadow: 0 4mm 8mm #123f5066; } .rounded { border-radius: 12mm; background: #e8f3f4; } .dashed { border: 2mm dashed #dd704f; } .rotated { transform: rotate(-5deg); background: #123f50; color: white; } .faded { opacity: .35; background: #dd704f; } svg { width: 100%; margin-top: 10mm; }`
  }
] as const satisfies readonly GalleryExample[];

export function findGalleryExample(id: string | undefined): GalleryExample {
  return galleryExamples.find((example) => example.id === id) ?? galleryExamples[0];
}
