import {
  galleryExamples as exampleData
} from "./gallery-examples-data.js";
import type { GalleryExample } from "./gallery-types.js";

type NonEmptyExamples = readonly GalleryExample[] & {
  readonly 0: GalleryExample;
};

export const galleryExamples: NonEmptyExamples = exampleData;

export function findGalleryExample(id: string | undefined): GalleryExample {
  return galleryExamples.find((example) => example.id === id) ?? galleryExamples[0];
}
