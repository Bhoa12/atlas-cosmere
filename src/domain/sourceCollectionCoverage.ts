import { hasValidSourceCatalog, SourceCatalogEntry } from "./sourceCatalog";

export interface SourceCollectionCoverage {
  sourceCollectionId: string;
  expectedEntryIds: readonly string[];
}

export interface SourceCoverageResult {
  status: "complete" | "incomplete" | "blocked";
  sourceCollectionId: string;
  missingEntryIds: readonly string[];
}

/**
 * Checks declared bibliographic coverage without inspecting source text.
 * Exact coverage is intentionally metadata-only: it says nothing about narrative
 * verification, chapter access, summaries, or spoiler safety.
 */
export function resolveSourceCollectionCoverage(
  catalog: readonly SourceCatalogEntry[],
  coverage: SourceCollectionCoverage,
): SourceCoverageResult {
  const blocked = (): SourceCoverageResult => ({
    status: "blocked",
    sourceCollectionId: "",
    missingEntryIds: [],
  });

  if (
    !hasValidSourceCatalog([...catalog]) ||
    typeof coverage.sourceCollectionId !== "string" ||
    !coverage.sourceCollectionId.trim() ||
    coverage.expectedEntryIds.length === 0
  ) return blocked();

  const expected = new Set<string>();
  for (const id of coverage.expectedEntryIds) {
    if (typeof id !== "string" || !id.trim() || expected.has(id)) return blocked();
    expected.add(id);
  }

  const present = new Set(
    catalog
      .filter((entry) => entry.sourceCollectionId === coverage.sourceCollectionId)
      .map((entry) => entry.id),
  );

  const missingEntryIds = coverage.expectedEntryIds.filter((id) => !present.has(id));
  return {
    status: missingEntryIds.length === 0 ? "complete" : "incomplete",
    sourceCollectionId: coverage.sourceCollectionId,
    missingEntryIds,
  };
}
