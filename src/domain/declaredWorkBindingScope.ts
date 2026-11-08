import { SourceWorkBinding, validateSourceWorkBindings } from "./sourceWorkBinding";

export interface DeclaredWorkBindingScope {
  status: "valid" | "blocked";
  inScopeBindings: readonly SourceWorkBinding[];
  outOfScopeBindings: readonly SourceWorkBinding[];
}

/**
 * Audits explicit source-to-work bindings against the works that the current
 * reading model declares. It does not infer missing works or silently discard
 * bindings that target an undeclared work.
 */
export function resolveDeclaredWorkBindingScope(
  declaredWorkIds: readonly string[],
  bindings: readonly SourceWorkBinding[],
): DeclaredWorkBindingScope {
  const normalizedWorks = declaredWorkIds.map((id) =>
    typeof id === "string" ? id.trim() : "",
  );

  if (
    normalizedWorks.length === 0 ||
    normalizedWorks.some((id) => !id) ||
    new Set(normalizedWorks).size !== normalizedWorks.length ||
    validateSourceWorkBindings(bindings).length > 0
  ) {
    return { status: "blocked", inScopeBindings: [], outOfScopeBindings: [] };
  }

  const declared = new Set(normalizedWorks);
  const inScopeBindings = bindings.filter((binding) =>
    declared.has(binding.workId.trim()),
  );
  const outOfScopeBindings = bindings.filter((binding) =>
    !declared.has(binding.workId.trim()),
  );

  return {
    status: outOfScopeBindings.length === 0 ? "valid" : "blocked",
    inScopeBindings,
    outOfScopeBindings,
  };
}
