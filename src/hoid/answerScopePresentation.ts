import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import {
  canonicalizeHoidAnswerBookScope,
  selectedEvidenceSatisfiesHoidBookScope,
  type HoidAnswerBookScope,
} from "./answerScope";

/**
 * Result of binding a trusted, already-renderable answer presentation to the
 * exact work set selected by the reader. This is a presentation consistency
 * check, not a progress grant; the trusted presenter remains authoritative
 * for per-book chapter unlocks.
 */
export type HoidPresentedAnswerScopeResult =
  | Readonly<{ status: "ready"; sourceBookIds: readonly string[] }>
  | Readonly<{
      status: "unavailable";
      reason: "invalid-presentation" | "invalid-scope" | "scope-mismatch";
    }>;

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const TITLES = new Map(HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work.title] as const));
const WORK_ORDER = new Map(HOID_SOURCE_BIBLIOGRAPHY.map((work, index) => [work.id, index] as const));

function exactDataRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string" || !allowedKeys.includes(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    for (const key of requiredKeys) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    }
    return result;
  } catch {
    return null;
  }
}

function denseIds(value: unknown, maximum: number): readonly string[] | null {
  try {
    if (
      !Array.isArray(value) ||
      value.length < 1 ||
      value.length > maximum ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;

    const result: string[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true ||
        typeof descriptor.value !== "string" ||
        !ID_PATTERN.test(descriptor.value) ||
        seen.has(descriptor.value)
      ) return null;
      seen.add(descriptor.value);
      result.push(descriptor.value);
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

type CitationIdentity = Readonly<{
  evidenceId: string;
  sourceBookId: string;
  title: string;
}>;

function canonicalCitationIdentity(value: unknown): CitationIdentity | null {
  const record = exactDataRecord(
    value,
    ["evidenceId", "sourceBookId", "title", "chapter", "locatorId"],
    ["evidenceId", "sourceBookId", "title", "chapter", "locatorId"],
  );
  if (
    !record ||
    typeof record.evidenceId !== "string" ||
    !ID_PATTERN.test(record.evidenceId) ||
    typeof record.sourceBookId !== "string" ||
    !TITLES.has(record.sourceBookId) ||
    record.title !== TITLES.get(record.sourceBookId) ||
    typeof record.chapter !== "number" ||
    !Number.isSafeInteger(record.chapter) ||
    record.chapter < 1 ||
    typeof record.locatorId !== "string" ||
    record.locatorId.length < 1 ||
    record.locatorId.length > 256 ||
    /[\\x00-\\x1F\\x7F]/u.test(record.locatorId)
  ) return null;

  return Object.freeze({
    evidenceId: record.evidenceId,
    sourceBookId: record.sourceBookId,
    title: record.title as string,
  });
}

function denseCitationIdentities(value: unknown): readonly CitationIdentity[] | null {
  try {
    if (
      !Array.isArray(value) ||
      value.length < 1 ||
      value.length > 16 ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;

    const result: CitationIdentity[] = [];
    const seenEvidence = new Set<string>();
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      const citation = canonicalCitationIdentity(descriptor.value);
      if (!citation || seenEvidence.has(citation.evidenceId)) return null;
      seenEvidence.add(citation.evidenceId);
      result.push(citation);
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

/**
 * Verify that every displayed citation belongs to exactly the selected work
 * set. The caller must first obtain the presentation from the trusted screen
 * presenter, which independently rechecks evidence unlocks against live
 * progress. This function never reads EPUB content or modifies progress.
 */
export function validateHoidPresentedAnswerScope(
  presentationInput: unknown,
  scopeInput?: unknown,
): HoidPresentedAnswerScopeResult {
  const scope: HoidAnswerBookScope | undefined = scopeInput === undefined
    ? undefined
    : canonicalizeHoidAnswerBookScope(scopeInput) ?? undefined;
  if (scopeInput !== undefined && !scope) {
    return Object.freeze({ status: "unavailable", reason: "invalid-scope" });
  }

  const presentation = exactDataRecord(
    presentationInput,
    ["status", "text", "claimIds", "evidenceIds", "citations", "layout", "segments"],
    ["status", "text", "claimIds", "evidenceIds", "citations"],
  );
  if (
    !presentation ||
    presentation.status !== "ready" ||
    typeof presentation.text !== "string" ||
    presentation.text.length < 1 ||
    presentation.text.length > 32_000 ||
    presentation.text !== presentation.text.trim()
  ) return Object.freeze({ status: "unavailable", reason: "invalid-presentation" });

  const hasLayout = Object.prototype.hasOwnProperty.call(presentation, "layout");
  const hasSegments = Object.prototype.hasOwnProperty.call(presentation, "segments");
  if (hasLayout !== hasSegments) {
    return Object.freeze({ status: "unavailable", reason: "invalid-presentation" });
  }

  const claimIds = denseIds(presentation.claimIds, 12);
  const evidenceIds = denseIds(presentation.evidenceIds, 16);
  const citations = denseCitationIdentities(presentation.citations);
  if (
    !claimIds ||
    !evidenceIds ||
    !citations ||
    evidenceIds.length !== citations.length ||
    evidenceIds.some(id => !citations.some(citation => citation.evidenceId === id))
  ) return Object.freeze({ status: "unavailable", reason: "invalid-presentation" });

  const sourceBookIds = [...new Set(citations.map(citation => citation.sourceBookId))]
    .sort((left, right) => WORK_ORDER.get(left)! - WORK_ORDER.get(right)!);
  if (sourceBookIds.length === 0) {
    return Object.freeze({ status: "unavailable", reason: "invalid-presentation" });
  }

  if (scope && !selectedEvidenceSatisfiesHoidBookScope(sourceBookIds, scope)) {
    return Object.freeze({ status: "unavailable", reason: "scope-mismatch" });
  }

  return Object.freeze({
    status: "ready",
    sourceBookIds: Object.freeze(sourceBookIds),
  });
}
