import "pagedjs";

declare module "pagedjs" {
  interface Previewer {
    readonly chunker?: {
      stop?: () => void;
    };
  }
}
