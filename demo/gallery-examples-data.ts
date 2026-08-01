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

const aliceLongFormHtml = `<article class="book">
  <section class="front-matter title-page">
    <p class="eyebrow">Long-form typesetting specimen</p>
    <h1>Alice's Adventures in Wonderland</h1>
    <p class="book-author">Lewis Carroll</p>
    <p class="book-deck">Selected passages from the first three chapters, arranged to test running heads and page-number restarts.</p>
    <p class="source-note">Public-domain text, first published in 1865. Source: <a href="https://www.gutenberg.org/ebooks/11">Project Gutenberg eBook #11</a>.</p>
  </section>
  <section class="front-matter contents-page">
    <p class="eyebrow">Contents</p>
    <h1>Three chapters</h1>
    <ol class="contents">
      <li>Down the Rabbit-Hole</li>
      <li>The Pool of Tears</li>
      <li>A Caucus-Race and a Long Tale</li>
    </ol>
    <p class="reader-note">The preliminary pages use lower-case Roman numerals. Chapter I restarts the page counter at Arabic 1.</p>
  </section>
  <section class="chapter chapter-start">
    <h1>Chapter I: Down the Rabbit-Hole</h1>
    <div class="chapter-page">
      <p>Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, "and what is the use of a book," thought Alice, "without pictures or conversations?"</p>
      <p>So she was considering in her own mind, as well as she could, for the hot day made her feel very sleepy and stupid, whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.</p>
      <p>There was nothing so very remarkable in that; nor did Alice think it so very much out of the way to hear the Rabbit say to itself, "Oh dear! Oh dear! I shall be late!" But when the Rabbit actually took a watch out of its waistcoat-pocket, and looked at it, and then hurried on, Alice started to her feet.</p>
      <p>Burning with curiosity, she ran across the field after it, and fortunately was just in time to see it pop down a large rabbit-hole under the hedge. In another moment down went Alice after it, never once considering how in the world she was to get out again.</p>
    </div>
    <div class="chapter-page chapter-continuation">
      <p>The rabbit-hole went straight on like a tunnel for some way, and then dipped suddenly down, so suddenly that Alice had not a moment to think about stopping herself before she found herself falling down a very deep well.</p>
      <p>Either the well was very deep, or she fell very slowly, for she had plenty of time as she went down to look about her and to wonder what was going to happen next. She looked at the sides of the well, and noticed that they were filled with cupboards and book-shelves; here and there she saw maps and pictures hung upon pegs.</p>
      <p>Down, down, down. Would the fall never come to an end? Alice wondered how many miles she had fallen and whether she might come out among the people who walked with their heads downward. There was nothing else to do, so she soon began talking again about Dinah, her cat.</p>
      <p>She was dozing off when suddenly, thump! thump! down she came upon a heap of sticks and dry leaves, and the fall was over. Alice jumped to her feet. Before her was another long passage, and the White Rabbit was still in sight, hurrying down it.</p>
    </div>
  </section>
  <section class="chapter">
    <h1>Chapter II: The Pool of Tears</h1>
    <div class="chapter-page">
      <p>"Curiouser and curiouser!" cried Alice; "now I'm opening out like the largest telescope that ever was! Good-bye, feet!" For when she looked down at her feet, they seemed to be almost out of sight, they were getting so far off.</p>
      <p>Just then her head struck against the roof of the hall: in fact she was now more than nine feet high, and she at once took up the little golden key and hurried off to the garden door.</p>
      <p>Poor Alice! It was as much as she could do, lying down on one side, to look through into the garden with one eye; but to get through was more hopeless than ever. She sat down and began to cry again.</p>
      <p>She went on shedding gallons of tears, until there was a large pool all round her, about four inches deep and reaching half down the hall. After a time she heard a little pattering of feet in the distance, and hastily dried her eyes to see what was coming.</p>
    </div>
    <div class="chapter-page chapter-continuation">
      <p>It was the White Rabbit returning, splendidly dressed, with a pair of white kid gloves in one hand and a large fan in the other. Alice began, in a low, timid voice, "If you please, sir--" The Rabbit started violently, dropped the gloves and the fan, and hurried away into the darkness.</p>
      <p>Alice took up the fan and gloves. "Dear, dear! How queer everything is today! And yesterday things went on just as usual. I wonder if I've been changed in the night?"</p>
      <p>As she said these words her foot slipped, and in another moment, splash! she was up to her chin in salt water. She soon made out that she was in the pool of tears which she had wept when she was nine feet high.</p>
      <p>Just then she heard something splashing about in the pool a little way off. At first she thought it must be a walrus or hippopotamus, but then she remembered how small she was now, and soon made out that it was only a mouse that had slipped in like herself.</p>
    </div>
  </section>
  <section class="chapter">
    <h1>Chapter III: A Caucus-Race and a Long Tale</h1>
    <div class="chapter-page">
      <p>They were indeed a queer-looking party that assembled on the bank--the birds with draggled feathers, the animals with their fur clinging close to them, and all dripping wet, cross, and uncomfortable.</p>
      <p>The first question of course was how to get dry again. They had a consultation about this, and after a few minutes it seemed quite natural to Alice to find herself talking familiarly with them, as if she had known them all her life.</p>
      <p>At last the Mouse, who seemed to be a person of authority among them, called out, "Sit down, all of you, and listen to me! I'll soon make you dry enough!" They all sat down at once, in a large ring, with the Mouse in the middle.</p>
      <p>The Mouse began the driest thing it knew, a history of William the Conqueror, but Alice remained as wet as ever. In that case, said the Dodo solemnly, the meeting ought to adopt more energetic remedies.</p>
    </div>
    <div class="chapter-page chapter-continuation">
      <p>"What I was going to say," said the Dodo in an offended tone, "was that the best thing to get us dry would be a Caucus-race." Alice asked what a Caucus-race was. The Dodo replied that the best way to explain it was to do it.</p>
      <p>First it marked out a race-course, in a sort of circle--the exact shape did not matter--and then all the party were placed along the course, here and there. There was no "One, two, three, and away," but they began running when they liked and left off when they liked.</p>
      <p>When they had been running half an hour or so, and were quite dry again, the Dodo suddenly called out, "The race is over!" They all crowded round it, panting, and asking, "But who has won?"</p>
      <p>At last the Dodo said, "Everybody has won, and all must have prizes." Alice pulled a box of comfits from her pocket and handed them round. There was exactly one apiece, all round.</p>
    </div>
  </section>
</article>`;

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
    title: "Long-form chapters & page-number reset",
    shortTitle: "Chapters & numbering",
    summary:
      "A public-domain story demonstrates changing running heads and Roman-to-Arabic page numbering.",
    support: "partial",
    features: [
      "long-form flow",
      "string-set",
      "string()",
      "counter-reset",
      "counter styles"
    ],
    compareNotes: [
      "The Paged.js HTML pane shows changing chapter heads and the numbering restart.",
      "Generated running text and counters may be absent from the PDF."
    ],
    html: aliceLongFormHtml,
    css: `@page front-matter { size: A5; margin: 18mm 16mm 20mm; @bottom-center { content: counter(page, lower-roman); font: 8pt Arial; } } @page chapter { size: A5; margin: 18mm 16mm 20mm; @bottom-center { content: counter(page, decimal); font: 8pt Arial; } } @page chapter:left { @top-left { content: string(chapter); font: 700 7pt Arial; } } @page chapter:right { @top-right { content: string(chapter); font: 700 7pt Arial; } } ${baseCss} body { font-size: 10pt; line-height: 1.45; } .book h1 { font-size: 22pt; } .front-matter { page: front-matter; } .title-page { break-after: page; padding-top: 25mm; } .book-author { color: #c9472d; font: 700 13pt Arial; } .book-deck { margin-top: 14mm; font-size: 13pt; line-height: 1.4; } .source-note, .reader-note { margin-top: 18mm; color: #536871; font: 8pt/1.5 Arial; } .source-note a { color: #126c86; } .contents-page { break-before: page; } .contents { margin: 12mm 0 0; padding: 0; list-style-position: inside; font: 700 12pt/2 Arial; } .chapter { page: chapter; break-before: page; } .chapter-start { counter-reset: page 1; } .chapter h1 { string-set: chapter content(text); } .chapter p { margin-bottom: 3mm; } .chapter-continuation { break-before: page; }`
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
