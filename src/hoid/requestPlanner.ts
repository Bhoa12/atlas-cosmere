import { HoidProgress, HoidQuery, QueryScope, resolveQueryScope } from "./queryScope";

/**
 * Provider-agnostic admission result. This module deliberately authorizes only
 * the request boundary; evidence retrieval and generation happen afterwards.
 */
export type HoidRequestPlan =
  | Readonly<{ ok: true; scope: Extract<QueryScope, { ok: true }>; progress: readonly HoidProgress[] }>
  | Readonly<{ ok: false; reason: Extract<QueryScope, { ok: false }>["reason"] | "NO_WORK_SCOPE" }>;

const freezeProgress = (progress: readonly HoidProgress[]) =>
  Object.freeze(progress.map((entry) => Object.freeze({ ...entry })));

export function planHoidRequest(
  query: HoidQuery,
  progress: readonly HoidProgress[],
): HoidRequestPlan {
  const scope = resolveQueryScope(query, progress);

  if (!scope.ok) return { ok: false, reason: scope.reason };

  // A question without an explicit work must never gain narrative access merely
  // because the reader has progress elsewhere. A caller may route such queries
  // to a metadata-only experience, but not to narrative evidence retrieval.
  if (!scope.workId) return { ok: false, reason: "NO_WORK_SCOPE" };

  return Object.freeze({
    ok: true,
    scope: Object.freeze({ ...scope }),
    progress: freezeProgress(progress),
  });
}
