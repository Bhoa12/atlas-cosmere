export type ContentVisibility = 'visible' | 'locked';

export interface SpoilerContent {
  id: string;
  workId: string;
  requiredUnitIds: readonly string[];
}

/**
 * Pure, editorially-neutral visibility resolver.
 * It never decides what is a spoiler; callers supply explicit technical gates.
 */
export function resolveContentVisibility(
  content: SpoilerContent,
  completedUnitIds: readonly string[],
): ContentVisibility {
  const completed = new Set(completedUnitIds);
  if (completed.size !== completedUnitIds.length) return 'locked';
  if (!content.id || !content.workId) return 'locked';
  return content.requiredUnitIds.every((unitId) =>
    typeof unitId === 'string' && unitId.length > 0 && completed.has(unitId),
  ) ? 'visible' : 'locked';
}
