function tableReference(table: HTMLTableElement): string | undefined {
  const reference = table.dataset.ref;
  return reference === undefined || reference.length === 0
    ? undefined
    : reference;
}

export function repeatSplitTableHeaders(root: ParentNode): void {
  const headersByTable = new Map<string, HTMLTableSectionElement>();
  const tables = Array.from(
    root.querySelectorAll<HTMLTableElement>("table[data-ref]")
  );

  for (const table of tables) {
    const reference = tableReference(table);
    const header = table.tHead;
    if (
      reference !== undefined &&
      header !== null &&
      !headersByTable.has(reference)
    ) {
      headersByTable.set(reference, header);
    }
  }

  for (const table of tables) {
    if (!table.hasAttribute("data-split-from") || table.tHead !== null) {
      continue;
    }
    const sourceReference = table.dataset.splitFrom;
    const sourceHeader = sourceReference === undefined
      ? undefined
      : headersByTable.get(sourceReference);
    if (sourceHeader === undefined) {
      continue;
    }
    table.insertBefore(
      sourceHeader.cloneNode(true),
      table.firstChild
    );
  }
}
