export type ReadingProgress = Readonly<Record<string, number>>;

export type ContextScope = {
  workId: string;
  chapter: number;
};

/**
 * Builds the smallest narrative scope needed for a request.
 *
 * The budget is intentionally immutable and fail-closed: unknown works,
 * invalid chapters, future chapters and duplicate scopes are rejected.
 * Catalog membership alone never grants narrative access.
 */
export function buildContextBudget(
  progress: ReadingProgress,
  requested: readonly ContextScope[],
): readonly ContextScope[] {
  const seen = new Set<string>();
  const budget: ContextScope[] = [];

  for (const scope of requested) {
    if (!scope.workId || !Number.isInteger(scope.chapter) || scope.chapter < 1) continue;

    const reached = progress[scope.workId];
    if (!Number.isInteger(reached) || reached < scope.chapter) continue;

    const key = `${scope.workId}:${scope.chapter}`;
    if (seen.has(key)) continue;
    seen.add(key);
    budget.push(Object.freeze({ workId: scope.workId, chapter: scope.chapter }));
  }

  return Object.freeze(budget);
}

export function isScopeAuthorized(
  budget: readonly ContextScope[],
  candidate: ContextScope,
): boolean {
  return budget.some(
    (scope) =>
      scope.workId === candidate.workId &&
      scope.chapter === candidate.chapter,
  );
}
