declare module "css-tree" {
  interface CssNode {
    type: string;
    name?: string;
    value?: string;
  }

  interface ParseOptions {
    readonly context?: "declarationList" | "stylesheet";
    readonly parseCustomProperty?: boolean;
  }

  export function parse(source: string, options?: ParseOptions): CssNode;
  export function generate(node: CssNode): string;
  export function walk(
    node: CssNode,
    options:
      | ((node: CssNode) => void)
      | { readonly enter: (node: CssNode) => void }
  ): void;
}
