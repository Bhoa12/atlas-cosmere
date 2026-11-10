import { ReadingUnitManifestEntry } from "./readingUnitManifest";

export interface SpoilerRequirement {
  contentId: string;
  requiredUnitIds: readonly string[];
}

export interface SpoilerVisibility {
  contentId: string;
  visibility: "visible" | "blocked";
}

/**
 * Evaluates metadata-only spoiler requirements against validated progress.
 * Every declared requirement must be explicitly completed; empty requirements
 * are intentionally treated as visible because no spoiler dependency exists.
 */
export function resolveSpoilerVisibility(
  manifest: readonly ReadingUnitManifestEntry[],
  manifestValid: boolean,
  completedUnitIds: readonly string[],
  requirements: readonly SpoilerRequirement[],
): readonly SpoilerVisibility[] {
  if (!manifestValid) return requirements.map((item) => ({ contentId: item.contentId, visibility: "blocked" }));

  const known = new Set(manifest.map((unit) => unit.unitId));
  const completed = new Set<string>();
  for (const id of completedUnitIds) {
    if (!id.trim() || !known.has(id) || completed.has(id)) {
      return requirements.map((item) => ({ contentId: item.contentId, visibility: "blocked" }));
    }
    completed.add(id);
  }

  const seenContent = new Set<string>();
  const result: SpoilerVisibility[] = [];
  for (const item of requirements) {
    if (!item || !item.contentId.trim() || seenContent.has(item.contentId)) {
      return requirements.map((entry) => ({ contentId: entry.contentId, visibility: "blocked" }));
    }
    seenContent.add(item.contentId);
    const required = new Set<string>();
    for (const unitId of item.requiredUnitIds) {
      if (!unitId.trim() || !known.has(unitId) || required.has(unitId)) {
        return requirements.map((entry) => ({ contentId: entry.contentId, visibility: "blocked" }));
      }
      required.add(unitId);
    }
    result.push({
      contentId: item.contentId,
      visibility: [...required].every((unitId) => completed.has(unitId)) ? "visible" : "blocked",
    });
  }
  return result;
}
