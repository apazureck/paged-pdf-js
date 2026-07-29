declare module "pagedjs" {
  export class Previewer {
    public polisher?: { destroy: () => void };
    public preview(
      content?: HTMLElement | DocumentFragment | string,
      stylesheets?: Array<string | Record<string, string>>,
      renderTo?: HTMLElement | string
    ): Promise<unknown>;
  }
}
