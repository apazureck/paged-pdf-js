const CALL_SELECTOR = "[data-footnote-call]";
const NOTE_SELECTOR = "[data-footnote-marker]";
const CALL_LABEL_CLASS = "paged-pdf-footnote-call-label";
const NOTE_LABEL_CLASS = "paged-pdf-footnote-note-label";
const SOURCE_SELECTOR = ".footnote";

function footnoteReference(element: HTMLElement): string | undefined {
  const reference = element.dataset.ref;
  return reference === undefined || reference.length === 0
    ? undefined
    : reference;
}

function footnoteLabel(element: HTMLElement, number: number): string {
  if (element.classList.contains("footnote-bracketed")) {
    return `[${number}]`;
  }
  if (element.classList.contains("footnote-parenthesized")) {
    return `(${number})`;
  }
  return String(number);
}

export function prepareFootnoteLabels(root: ParentNode): void {
  Array.from(root.querySelectorAll<HTMLElement>(SOURCE_SELECTOR))
    .forEach((footnote, index) => {
      footnote.dataset.footnoteLabel = footnoteLabel(footnote, index + 1);
    });
}
function appendCallLabel(
  call: HTMLElement,
  label: string,
  number: number
): void {
  call.classList.add("paged-pdf-footnote-call");
  call.dataset.footnoteNumber = String(number);
  call.setAttribute("aria-label", `Footnote ${number}`);
  if (call.querySelector(`.${CALL_LABEL_CLASS}`) !== null) {
    return;
  }
  const marker = call.ownerDocument.createElement("span");
  marker.className = CALL_LABEL_CLASS;
  marker.textContent = label;
  call.append(marker);
}

function prependNoteLabel(
  note: HTMLElement,
  label: string,
  number: number
): void {
  note.classList.add("paged-pdf-footnote-note");
  note.dataset.footnoteNumber = String(number);
  if (note.querySelector(`.${NOTE_LABEL_CLASS}`) !== null) {
    return;
  }
  const marker = note.ownerDocument.createElement("span");
  marker.className = NOTE_LABEL_CLASS;
  marker.textContent = `${label} `;
  note.prepend(marker);
}

export function materializeFootnoteMarkers(root: ParentNode): void {
  const labelsByReference = new Map<
    string,
    { readonly label: string; readonly number: number }
  >();
  const calls = Array.from(
    root.querySelectorAll<HTMLElement>(CALL_SELECTOR)
  );

  calls.forEach((call, index) => {
    const number = index + 1;
    const label = footnoteLabel(call, number);
    const reference = footnoteReference(call);
    if (reference !== undefined) {
      labelsByReference.set(reference, { label, number });
    }
    appendCallLabel(call, label, number);
  });

  Array.from(root.querySelectorAll<HTMLElement>(NOTE_SELECTOR))
    .forEach((note, index) => {
      const reference = footnoteReference(note);
      const fallbackNumber = index + 1;
      const marker = reference === undefined
        ? undefined
        : labelsByReference.get(reference);
      prependNoteLabel(
        note,
        marker?.label ?? footnoteLabel(note, fallbackNumber),
        marker?.number ?? fallbackNumber
      );
    });
}
