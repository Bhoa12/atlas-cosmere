import type { CanonicalId, ReadingProgress } from "./cosmereContentModel";

export type ContentRecord = {
  id: CanonicalId;
  workId: CanonicalId;
  requiredUnitIds: CanonicalId[];
};

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function hasValidIds(values: string[]): boolean {
  return values.every((value) => ID.test(value));
}

/**
 * Resolves anti-spoiler visibility for catalogued content.
 *
 * This boundary is intentionally editorially neutral: it validates only
 * technical identifiers and reading progress. It does not classify facts,
 * infer spoilers, or expose protected source text.
 */
export function resolveContentAccess(
  content: ContentRecord,
  progress: ReadingProgress,
): "visible" | "locked" {
  if (!ID.test(content.id) || !ID.test(content.workId)) return "locked";
  if (!ID.test(progress.workId) || content.workId !== progress.workId) return "locked";
  if (!hasValidIds(content.requiredUnitIds) || !hasValidIds(progress.completedUnitIds)) return "locked";
  if (new Set(content.requiredUnitIds).size !== content.requiredUnitIds.length) return "locked";
  if (new Set(progress.completedUnitIds).size !== progress.completedUnitIds.length) return "locked";

  const completed = new Set(progress.completedUnitIds);
  return content.requiredUnitIds.every((id) => completed.has(id))
    ? "visible"
    : "locked";
}
