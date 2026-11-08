export interface SourceWorkBinding {
  sourceId: string;
  workId: string;
}

/**
 * Validates a deliberately editorial-neutral mapping between a declared source
 * and the work identifier used by the reading model. A source can authorize
 * only one work in this registry, while several independently cataloged sources
 * may explicitly support the same work.
 */
export function validateSourceWorkBindings(
  bindings: readonly SourceWorkBinding[],
): string[] {
  const errors: string[] = [];
  const sourceIds = new Set<string>();

  for (const binding of bindings) {
    const sourceId = typeof binding.sourceId === "string" ? binding.sourceId.trim() : "";
    const workId = typeof binding.workId === "string" ? binding.workId.trim() : "";

    if (!sourceId) errors.push("Binding source id is required");
    if (!workId) errors.push("Binding work id is required");
    if (sourceId && sourceIds.has(sourceId)) {
      errors.push("Binding source ids must be unique");
    }
    if (sourceId) sourceIds.add(sourceId);
  }

  return errors;
}

/**
 * Returns true only when the entire binding registry is valid and the declared
 * source is explicitly bound to the requested work. Missing provenance never
 * falls back to title matching or inferred editorial metadata.
 */
export function isSourceBoundToWork(
  sourceId: string,
  workId: string,
  bindings: readonly SourceWorkBinding[],
): boolean {
  if (
    typeof sourceId !== "string" ||
    typeof workId !== "string" ||
    !sourceId.trim() ||
    !workId.trim() ||
    validateSourceWorkBindings(bindings).length > 0
  ) {
    return false;
  }

  return bindings.some(
    (binding) =>
      binding.sourceId.trim() === sourceId.trim() &&
      binding.workId.trim() === workId.trim(),
  );
}
