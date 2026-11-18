import type { HoidEvidenceAnswer, HoidEvidenceRuntime } from "./evidenceRuntime";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";

export type HoidApprovedClaimAnswerRecord = Readonly<{
  claimId: string;
  answer: HoidEvidenceAnswer;
}>;

const CLAIM_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const MAX_CLAIM_IDS = 512;

function canonicalClaimIds(value: unknown): readonly string[] | null {
  try {
    if (
      !Array.isArray(value) ||
      value.length < 1 ||
      value.length > MAX_CLAIM_IDS ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;

    const ids: string[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true ||
        typeof descriptor.value !== "string" ||
        descriptor.value !== descriptor.value.trim() ||
        !CLAIM_ID_PATTERN.test(descriptor.value) ||
        seen.has(descriptor.value)
      ) return null;
      seen.add(descriptor.value);
      ids.push(descriptor.value);
    }
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length) {
        return null;
      }
    }
    return Object.freeze(ids);
  } catch {
    return null;
  }
}

/**
 * Creates a local-only renderer for claim IDs selected by the approved topic
 * assignment registry. Its public boundary accepts the authoritative SQLite
 * v2 cursor snapshot. The adapter validates that snapshot and projects only
 * completed-through chapters into the legacy ReadingPosition contract used by
 * HoidEvidenceRuntime; the open chapter is never treated as completed.
 *
 * It never calls a language provider or accepts prose. Each result is an exact,
 * chapter-authorized editorial claim with its own evidence segment and citation
 * manifest.
 */
export function createHoidApprovedClaimAnswerPort(
  runtime: HoidEvidenceRuntime | null,
): ((claimIds: readonly string[], progressSnapshot: unknown) => readonly HoidApprovedClaimAnswerRecord[]) | undefined {
  if (runtime === null || typeof runtime.renderApprovedClaimById !== "function") return undefined;

  return (claimIdsInput, progressSnapshot) => {
    const claimIds = canonicalClaimIds(claimIdsInput);
    if (!claimIds) return Object.freeze([]);

    const projection = projectHoidCursorProgressSnapshot(progressSnapshot);
    if (projection.status !== "ready") return Object.freeze([]);

    const records: HoidApprovedClaimAnswerRecord[] = [];
    for (const claimId of claimIds) {
      const answer = runtime.renderApprovedClaimById(claimId, projection.reading);
      if (
        answer.status !== "authorized" ||
        answer.claimIds.length !== 1 ||
        answer.claimIds[0] !== claimId ||
        !answer.segments ||
        answer.segments.length !== 1 ||
        answer.segments[0].claimId !== claimId
      ) continue;
      records.push(Object.freeze({ claimId, answer }));
    }
    return Object.freeze(records);
  };
}
