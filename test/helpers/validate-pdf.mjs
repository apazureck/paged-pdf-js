import { readFile } from "node:fs/promises";

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const filePath = process.argv[2];
if (filePath === undefined) {
  throw new Error("A PDF file path is required.");
}

const bytes = new Uint8Array(await readFile(filePath));
const loadingTask = getDocument({ data: bytes });
const pdf = await loadingTask.promise;
const firstPage = await pdf.getPage(1);

process.stdout.write(
  JSON.stringify({
    pageCount: pdf.numPages,
    width: firstPage.view[2],
    height: firstPage.view[3]
  })
);

await loadingTask.destroy();
