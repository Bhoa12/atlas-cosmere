/**
 * Generic anti-spoiler gate.
 *
 * The policy knows nothing about plot, characters, places, chapters or canon.
 * Callers provide stable technical IDs and the reader's completed unit IDs.
 * Unknown or malformed input is blocked rather than exposed.
 */

export type SpoilerContent<T> = {
  id: string;
  requiredUnitIds: readonly string[];
  payload: T;
};

export type SpoilerGateResult<T> =
  | { status: 'visible'; content: T }
  | { status: 'blocked'; reason: 'invalid_content' | 'incomplete_progress' };

function isCanonicalId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

export function resolveSpoilerGate<T>(
  content: unknown,
  completedUnitIds: unknown,
): SpoilerGateResult<T> {
  if (!content || typeof content !== 'object' || !Array.isArray(completedUnitIds)) {
    return { status: 'blocked', reason: 'invalid_content' };
  }

  const candidate = content as Partial<SpoilerContent<T>>;
  if (!isCanonicalId(candidate.id) || !Array.isArray(candidate.requiredUnitIds)) {
    return { status: 'blocked', reason: 'invalid_content' };
  }

  const completed = new Set<string>();
  for (const id of completedUnitIds) {
    if (!isCanonicalId(id) || completed.has(id)) {
      return { status: 'blocked', reason: 'invalid_content' };
    }
    completed.add(id);
  }

  const required = new Set<string>();
  for (const id of candidate.requiredUnitIds) {
    if (!isCanonicalId(id) || required.has(id)) {
      return { status: 'blocked', reason: 'invalid_content' };
    }
    required.add(id);
  }

  for (const id of required) {
    if (!completed.has(id)) {
      return { status: 'blocked', reason: 'incomplete_progress' };
    }
  }

  return { status: 'visible', content: candidate.payload as T };
}
