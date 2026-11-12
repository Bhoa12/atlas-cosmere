// Boundary tests: metadata only, no protected text.
// These examples intentionally use synthetic titles and identifiers.
export function validateSourceEntry(entry: { id: string; title: string; sourceId: string }): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id)
    && entry.title.trim().length > 0
    && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.sourceId);
}

export function sourceEntryBoundaryCases(): boolean[] {
  return [
    validateSourceEntry({ id: "sample-work", title: "Sample Work", sourceId: "private-catalogue" }),
    !validateSourceEntry({ id: "Bad ID", title: "Sample", sourceId: "private-catalogue" }),
    !validateSourceEntry({ id: "sample-work", title: "   ", sourceId: "private-catalogue" }),
  ];
}
