export type PdfColor = readonly [red: number, green: number, blue: number];
export type PdfFontFamily = "courier" | "helvetica" | "times";
export type PdfFontStyle = "bold" | "bolditalic" | "italic" | "normal";

export interface FillCommand {
  readonly kind: "fill";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly color: PdfColor;
}

export interface TextCommand {
  readonly kind: "text";
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly fontFamily: PdfFontFamily;
  readonly fontStyle: PdfFontStyle;
  readonly fontSize: number;
  readonly color: PdfColor;
}

export interface ImageCommand {
  readonly kind: "image";
  readonly source: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface LinkCommand {
  readonly kind: "link";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly url: string;
}

export type DrawCommand =
  | FillCommand
  | ImageCommand
  | LinkCommand
  | TextCommand;

export interface VectorPage {
  readonly widthCssPixels: number;
  readonly heightCssPixels: number;
  readonly commands: readonly DrawCommand[];
}
