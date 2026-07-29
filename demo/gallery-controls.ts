import "./gallery-controls.css";

import {
  defaultPlaygroundSettings,
  type PlaygroundSettings
} from "./gallery-playground.js";

interface ControlDefinition {
  readonly key: keyof PlaygroundSettings;
  readonly id: string;
  readonly label: string;
  readonly minimum: number;
  readonly maximum: number;
  readonly step: number;
  readonly unit: string;
}

interface GalleryControls {
  readonly update: (settings: PlaygroundSettings) => void;
}

const controlDefinitions: readonly ControlDefinition[] = [
  {
    key: "marginMm",
    id: "margin",
    label: "Page margin",
    minimum: 5,
    maximum: 40,
    step: 1,
    unit: "mm"
  },
  {
    key: "fontSizePt",
    id: "text",
    label: "Body text",
    minimum: 8,
    maximum: 16,
    step: 0.5,
    unit: "pt"
  },
  {
    key: "lineHeight",
    id: "leading",
    label: "Line height",
    minimum: 1.1,
    maximum: 2,
    step: 0.05,
    unit: ""
  },
  {
    key: "paragraphGapMm",
    id: "gap",
    label: "Paragraph gap",
    minimum: 0,
    maximum: 8,
    step: 0.5,
    unit: "mm"
  },
  {
    key: "headingSizePt",
    id: "heading",
    label: "Heading size",
    minimum: 18,
    maximum: 42,
    step: 1,
    unit: "pt"
  }
];

function formatValue(value: number, unit: string): string {
  return `${Number(value.toFixed(2))}${unit === "" ? "" : ` ${unit}`}`;
}

function settingsEqual(
  left: PlaygroundSettings,
  right: PlaygroundSettings
): boolean {
  return controlDefinitions.every(
    ({ key }) => left[key] === right[key]
  );
}

export function createGalleryControls(
  proofGrid: HTMLElement,
  initialSettings: PlaygroundSettings,
  onInput: (settings: PlaygroundSettings) => void
): GalleryControls {
  let settings = { ...initialSettings };
  const panel = document.createElement("section");
  panel.className = "tuning-panel";
  panel.setAttribute("aria-labelledby", "tuning-title");

  const header = document.createElement("header");
  header.className = "tuning-header";
  const headingGroup = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Interactive variables";
  const heading = document.createElement("h3");
  heading.id = "tuning-title";
  heading.textContent = "Tune this proof";
  headingGroup.append(eyebrow, heading);
  const reset = document.createElement("button");
  reset.type = "button";
  reset.textContent = "Reset parameters";
  header.append(headingGroup, reset);

  const fieldset = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.className = "sr-only";
  legend.textContent = "Print parameters";
  const grid = document.createElement("div");
  grid.className = "tuning-grid";
  fieldset.append(legend, grid);

  const controls = new Map<
    keyof PlaygroundSettings,
    { readonly input: HTMLInputElement; readonly output: HTMLOutputElement }
  >();

  function refresh(nextSettings: PlaygroundSettings): void {
    settings = { ...nextSettings };
    for (const definition of controlDefinitions) {
      const control = controls.get(definition.key);
      if (control === undefined) {
        continue;
      }
      const value = settings[definition.key];
      const formatted = formatValue(value, definition.unit);
      control.input.value = String(value);
      control.input.setAttribute("aria-valuetext", formatted);
      control.output.value = formatted;
      control.output.textContent = formatted;
    }
    reset.disabled = settingsEqual(settings, defaultPlaygroundSettings);
  }

  for (const definition of controlDefinitions) {
    const wrapper = document.createElement("div");
    wrapper.className = "tuning-control";
    wrapper.dataset.testid = "playground-control";
    const label = document.createElement("label");
    label.className = "tuning-label";
    label.htmlFor = `control-${definition.id}`;
    const labelText = document.createElement("span");
    labelText.textContent = definition.label;
    const output = document.createElement("output");
    output.htmlFor = `control-${definition.id}`;
    output.dataset.testid = `value-${definition.id}`;
    label.append(labelText, output);

    const input = document.createElement("input");
    input.id = `control-${definition.id}`;
    input.type = "range";
    input.min = String(definition.minimum);
    input.max = String(definition.maximum);
    input.step = String(definition.step);
    input.dataset.testid = `control-${definition.id}`;
    input.addEventListener("input", () => {
      const value = Number(input.value);
      settings = { ...settings, [definition.key]: value };
      refresh(settings);
      onInput(settings);
    });
    controls.set(definition.key, { input, output });
    wrapper.append(label, input);
    grid.append(wrapper);
  }

  reset.addEventListener("click", () => {
    refresh(defaultPlaygroundSettings);
    onInput(defaultPlaygroundSettings);
  });

  panel.append(header, fieldset);
  proofGrid.parentElement?.insertBefore(panel, proofGrid);
  refresh(settings);
  return { update: refresh };
}
