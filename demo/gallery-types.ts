import type { RenderMode } from "../src/types.js";

export type ExampleGroup =
  | "Page construction"
  | "Fragmentation"
  | "Generated content"
  | "Rich content"
  | "Known differences";

export type ExampleSupport = "match" | "pagedjs-only" | "partial";

export interface GalleryExample {
  readonly id: string;
  readonly group: ExampleGroup;
  readonly title: string;
  readonly shortTitle: string;
  readonly summary: string;
  readonly support: ExampleSupport;
  readonly features: readonly string[];
  readonly compareNotes: readonly string[];
  readonly html: string;
  readonly css: string;
  readonly fixedPageMarginSelectors?: readonly string[];
  readonly renderMode?: RenderMode;
}
