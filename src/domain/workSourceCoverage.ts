import { SourceCatalogEntry } from "./sourceCatalog";
import { SourceWorkBinding } from "./sourceWorkBinding";

export interface WorkSourceCoverage {
  status: "valid" | "blocked";
  workIds: readonly string[];
  sourceIdsByWork: Readonly<Record<string, readonly string[]>>;
  unknownBindingSourceIds: readonly string[];
}

/**
 * Resolves explicit source coverage by work without inferring editorial
 * relationships from titles or collection ordering. The catalog is treated
 * only as declared provenance metadata.
 */
export function resolveWorkSourceCoverage(
  catalog: readonly SourceCatalogEntry[],
  bindings: readonly SourceWorkBinding[],
): WorkSourceCoverage {
  const catalogIds = new Set(catalog.map((entry) => entry.id));
  if (catalog.length === 0 || catalogIds.size !== catalog.length) {
    return { status: "blocked", workIds: [], sourceIdsByWork: {}, unknownBindingSourceIds: [] };
  }

  const sourceIds = new Set<string>();
  const byWork: Record<string, string[]> = {};
  for (const binding of bindings) {
    const sourceId = typeof binding.sourceId === "string" ? binding.sourceId.trim() : "";
    const workId = typeof binding.workId === "string" ? binding.workId.trim() : "";
    if (!sourceId || !workId || sourceIds.has(sourceId)) {
      return { status: "blocked", workIds: [], sourceIdsByWork: {}, unknownBindingSourceIds: [] };
    }
    sourceIds.add(sourceId);
    if (!catalogIds.has(sourceId)) {
      return { status: "blocked", workIds: [], sourceIdsByWork: {}, unknownBindingSourceIds: [sourceId] };
    }
    (byWork[workId] ??= []).push(sourceId);
  }

  const workIds = Object.keys(byWork).sort();
  const sourceIdsByWork = Object.fromEntries(
    workIds.map((workId) => [workId, [...byWork[workId]].sort()]),
  );
  return { status: "valid", workIds, sourceIdsByWork, unknownBindingSourceIds: [] };
}
