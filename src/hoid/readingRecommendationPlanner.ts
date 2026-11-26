import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import {
  validateHoidChapterReference,
  type HoidChapterReference,
} from "./chapterReference";
import { getHoidReadingManifest } from "./readingManifest";
import { sha256Hex } from "./sha256";
import {
  validateHoidUnitProgressCursor,
} from "./unitProgressCursor";
import {
  validateHoidUnitProgressSnapshot,
  type HoidUnitProgressSnapshot,
} from "./unitProgressLedger";

/**
 * A recommendation to resume the exact unit already open in the reader's
 * progress ledger. It never guesses a next book or a cross-work reading order.
 */
export type HoidReadingRecommendation = Readonly<{
  schemaVersion: 1;
  kind: "resume-current-unit";
  reason: "unfinished-current-unit";
  workId: string;
  workTitle: string;
  /** Null when the visible chapter label is duplicated in this edition. */
  chapterNumber: number | null;
  /** Exact ordinal in the verified edition manifest. */
  ordinal: number;
  labelMode: "numbered-chapter" | "exact-unit";
  /** Edition-bound identity only; never contains the private EPUB locator. */
  reference: HoidChapterReference;
  /** The ledger's explicit registration order, not a recency estimate. */
  progressOrder: number | null;
}>;

export type HoidReadingRecommendationPlan = Readonly<{
  schemaVersion: 1;
  kind: "hoid-reading-recommendation-plan";
  maxRecommendations: number;
  catalogueFingerprint: string;
  progressRevision: number;
  progressFingerprint: string;
  candidates: readonly HoidReadingRecommendation[];
  fingerprint: string;
}>;

export type HoidReadingRecommendationBuildResult =
  | Readonly<{ status: "ready"; plan: HoidReadingRecommendationPlan }>
  | Readonly<{
      status: "no-active-work";
      progressRevision: number;
      progressFingerprint: string;
    }>
  | Readonly<{
      status: "unavailable";
      reason: "invalid-progress" | "invalid-limit" | "inconsistent-manifest";
    }>;

export type HoidReadingRecommendationPlanValidation =
  | Readonly<{ status: "valid"; plan: HoidReadingRecommendationPlan }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-plan"
        | "invalid-progress"
        | "stale-progress"
        | "catalogue-changed"
        | "fingerprint-mismatch";
    }>;

const DEFAULT_MAX_RECOMMENDATIONS = 5;
const MAX_RECOMMENDATIONS = 10;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const WORK_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const PLAN_KEYS = [
  "schemaVersion",
  "kind",
  "maxRecommendations",
  "catalogueFingerprint",
  "progressRevision",
  "progressFingerprint",
  "candidates",
  "fingerprint",
] as const;
const CANDIDATE_KEYS = [
  "schemaVersion",
  "kind",
  "reason",
  "workId",
  "workTitle",
  "chapterNumber",
  "ordinal",
  "labelMode",
  "reference",
  "progressOrder",
] as const;

const WORK_BY_ID = new Map(HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work]));
const CATALOGUE_FINGERPRINT = sha256Hex(JSON.stringify(
  HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work.title, work.sourceGroup]),
));

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== keys.length) return null;

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of ownKeys) {
      if (typeof key !== "string" || !keys.includes(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true) return null;
      result[key] = descriptor.value;
    }
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    }
    return result;
  } catch {
    return null;
  }
}

function denseArray(value: unknown, minimum: number, maximum: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || value.length < minimum || value.length > maximum ||
      Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;

    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true) return null;
      result.push(descriptor.value);
    }
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length) {
        return null;
      }
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function resolveLimit(value: unknown): number | null {
  if (value === undefined) return DEFAULT_MAX_RECOMMENDATIONS;
  const record = exactRecord(value, ["maxRecommendations"]);
  if (!record || typeof record.maxRecommendations !== "number" ||
    !Number.isSafeInteger(record.maxRecommendations) ||
    record.maxRecommendations < 1 ||
    record.maxRecommendations > MAX_RECOMMENDATIONS) return null;
  return record.maxRecommendations;
}

function candidateFingerprintValue(candidate: HoidReadingRecommendation): readonly unknown[] {
  return [
    candidate.workId,
    candidate.workTitle,
    candidate.chapterNumber,
    candidate.ordinal,
    candidate.labelMode,
    candidate.reference.identityFingerprint,
    candidate.progressOrder,
  ];
}

function planFingerprint(
  maxRecommendations: number,
  catalogueFingerprint: string,
  progressRevision: number,
  progressFingerprint: string,
  candidates: readonly HoidReadingRecommendation[],
): string {
  return sha256Hex(JSON.stringify([
    "hoid-reading-recommendation-plan-v1",
    maxRecommendations,
    catalogueFingerprint,
    progressRevision,
    progressFingerprint,
    candidates.map(candidateFingerprintValue),
  ]));
}

function compareRecommendations(
  left: HoidReadingRecommendation,
  right: HoidReadingRecommendation,
): number {
  const leftOrder = left.progressOrder ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.progressOrder ?? Number.MAX_SAFE_INTEGER;
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  return left.workId.localeCompare(right.workId);
}

function recommendationForPosition(
  position: HoidUnitProgressSnapshot["positions"][number],
): HoidReadingRecommendation | null {
  if ("completed" in position && position.completed === true) return null;
  if (!("cursor" in position)) return null;

  const cursor = validateHoidUnitProgressCursor(position.cursor);
  if (cursor.status !== "valid" || cursor.cursor.reference.bookId !== position.bookId) return null;

  const referenceResult = validateHoidChapterReference(cursor.cursor.reference);
  if (referenceResult.status !== "valid") return null;

  const manifestResult = getHoidReadingManifest(position.bookId);
  if (manifestResult.status !== "ready") return null;
  const unit = manifestResult.manifest.units.find(candidate =>
    candidate.id === referenceResult.reference.unitId &&
    candidate.ordinal === referenceResult.reference.ordinal &&
    candidate.chapterNumber === referenceResult.reference.chapterNumber
  );
  if (!unit) return null;

  const ambiguous = manifestResult.manifest.ambiguousChapterNumbers.includes(unit.chapterNumber);
  const work = WORK_BY_ID.get(position.bookId);
  if (!work) return null;

  return Object.freeze({
    schemaVersion: 1,
    kind: "resume-current-unit",
    reason: "unfinished-current-unit",
    workId: work.id,
    workTitle: work.title,
    chapterNumber: ambiguous ? null : unit.chapterNumber,
    ordinal: unit.ordinal,
    labelMode: ambiguous ? "exact-unit" : "numbered-chapter",
    reference: referenceResult.reference,
    progressOrder: position.order ?? null,
  });
}

/**
 * Build deterministic, provider-free recommendations from the authoritative
 * v3 progress snapshot. Only already-open, unfinished units are suggested.
 *
 * Cross-work "read this next" recommendations are intentionally excluded until
 * a separately trusted, editorially approved reading-path catalogue exists.
 */
export function buildHoidReadingRecommendationPlan(
  progressInput: unknown,
  optionsInput?: unknown,
): HoidReadingRecommendationBuildResult {
  const maxRecommendations = resolveLimit(optionsInput);
  if (maxRecommendations === null) {
    return Object.freeze({ status: "unavailable", reason: "invalid-limit" });
  }

  const progress = validateHoidUnitProgressSnapshot(progressInput);
  if (progress.status !== "valid") {
    return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
  }

  const progressFingerprint = sha256Hex(JSON.stringify(progress.snapshot));
  const candidates: HoidReadingRecommendation[] = [];
  for (const position of progress.snapshot.positions) {
    if ("completed" in position && position.completed === true) continue;
    const candidate = recommendationForPosition(position);
    if (!candidate) {
      return Object.freeze({ status: "unavailable", reason: "inconsistent-manifest" });
    }
    candidates.push(candidate);
  }

  candidates.sort(compareRecommendations);
  const selected = Object.freeze(candidates.slice(0, maxRecommendations));
  if (selected.length === 0) {
    return Object.freeze({
      status: "no-active-work",
      progressRevision: progress.snapshot.revision,
      progressFingerprint,
    });
  }

  const fingerprint = planFingerprint(
    maxRecommendations,
    CATALOGUE_FINGERPRINT,
    progress.snapshot.revision,
    progressFingerprint,
    selected,
  );
  return Object.freeze({
    status: "ready",
    plan: Object.freeze({
      schemaVersion: 1,
      kind: "hoid-reading-recommendation-plan",
      maxRecommendations,
      catalogueFingerprint: CATALOGUE_FINGERPRINT,
      progressRevision: progress.snapshot.revision,
      progressFingerprint,
      candidates: selected,
      fingerprint,
    }),
  });
}

function canonicalCandidate(value: unknown): HoidReadingRecommendation | null {
  const record = exactRecord(value, CANDIDATE_KEYS);
  if (!record || record.schemaVersion !== 1 || record.kind !== "resume-current-unit" ||
    record.reason !== "unfinished-current-unit" ||
    typeof record.workId !== "string" || !WORK_ID_PATTERN.test(record.workId) ||
    typeof record.workTitle !== "string" ||
    typeof record.ordinal !== "number" || !Number.isSafeInteger(record.ordinal) || record.ordinal < 1 ||
    (record.chapterNumber !== null &&
      (typeof record.chapterNumber !== "number" || !Number.isSafeInteger(record.chapterNumber) || record.chapterNumber < 1)) ||
    (record.labelMode !== "numbered-chapter" && record.labelMode !== "exact-unit") ||
    (record.progressOrder !== null &&
      (typeof record.progressOrder !== "number" || !Number.isSafeInteger(record.progressOrder) ||
        record.progressOrder < 0))) return null;

  const work = WORK_BY_ID.get(record.workId);
  if (!work || work.title !== record.workTitle) return null;
  const reference = validateHoidChapterReference(record.reference);
  if (reference.status !== "valid" || reference.reference.bookId !== work.id ||
    reference.reference.ordinal !== record.ordinal) return null;

  const manifest = getHoidReadingManifest(work.id);
  if (manifest.status !== "ready") return null;
  const ambiguous = manifest.manifest.ambiguousChapterNumbers.includes(reference.reference.chapterNumber);
  if ((record.labelMode === "exact-unit") !== ambiguous ||
    (ambiguous && record.chapterNumber !== null) ||
    (!ambiguous && record.chapterNumber !== reference.reference.chapterNumber)) return null;

  return Object.freeze({
    schemaVersion: 1,
    kind: "resume-current-unit",
    reason: "unfinished-current-unit",
    workId: work.id,
    workTitle: work.title,
    chapterNumber: ambiguous ? null : reference.reference.chapterNumber,
    ordinal: reference.reference.ordinal,
    labelMode: ambiguous ? "exact-unit" : "numbered-chapter",
    reference: reference.reference,
    progressOrder: record.progressOrder as number | null,
  });
}

/** Revalidate a displayed plan against a fresh authoritative progress snapshot. */
export function validateHoidReadingRecommendationPlan(
  planInput: unknown,
  progressInput: unknown,
): HoidReadingRecommendationPlanValidation {
  const record = exactRecord(planInput, PLAN_KEYS);
  if (!record || record.schemaVersion !== 1 ||
    record.kind !== "hoid-reading-recommendation-plan" ||
    typeof record.maxRecommendations !== "number" ||
    !Number.isSafeInteger(record.maxRecommendations) ||
    record.maxRecommendations < 1 ||
    record.maxRecommendations > MAX_RECOMMENDATIONS ||
    typeof record.catalogueFingerprint !== "string" || !SHA256_PATTERN.test(record.catalogueFingerprint) ||
    typeof record.progressRevision !== "number" || !Number.isSafeInteger(record.progressRevision) ||
    record.progressRevision < 0 ||
    typeof record.progressFingerprint !== "string" || !SHA256_PATTERN.test(record.progressFingerprint) ||
    typeof record.fingerprint !== "string" || !SHA256_PATTERN.test(record.fingerprint)) {
    return Object.freeze({ status: "invalid", reason: "invalid-plan" });
  }

  const rawCandidates = denseArray(record.candidates, 1, MAX_RECOMMENDATIONS);
  if (!rawCandidates || rawCandidates.length > record.maxRecommendations) {
    return Object.freeze({ status: "invalid", reason: "invalid-plan" });
  }
  const candidates: HoidReadingRecommendation[] = [];
  for (const raw of rawCandidates) {
    const candidate = canonicalCandidate(raw);
    if (!candidate) return Object.freeze({ status: "invalid", reason: "invalid-plan" });
    candidates.push(candidate);
  }

  const recomputedFingerprint = planFingerprint(
    record.maxRecommendations,
    record.catalogueFingerprint,
    record.progressRevision,
    record.progressFingerprint,
    candidates,
  );
  if (recomputedFingerprint !== record.fingerprint) {
    return Object.freeze({ status: "invalid", reason: "fingerprint-mismatch" });
  }
  if (record.catalogueFingerprint !== CATALOGUE_FINGERPRINT) {
    return Object.freeze({ status: "invalid", reason: "catalogue-changed" });
  }

  const progress = validateHoidUnitProgressSnapshot(progressInput);
  if (progress.status !== "valid") {
    return Object.freeze({ status: "invalid", reason: "invalid-progress" });
  }
  const progressFingerprint = sha256Hex(JSON.stringify(progress.snapshot));
  if (record.progressRevision !== progress.snapshot.revision ||
    record.progressFingerprint !== progressFingerprint) {
    return Object.freeze({ status: "invalid", reason: "stale-progress" });
  }

  const expected = buildHoidReadingRecommendationPlan(progress.snapshot, {
    maxRecommendations: record.maxRecommendations,
  });
  if (expected.status !== "ready" || expected.plan.fingerprint !== record.fingerprint ||
    JSON.stringify(expected.plan.candidates) !== JSON.stringify(candidates)) {
    return Object.freeze({ status: "invalid", reason: "fingerprint-mismatch" });
  }

  return Object.freeze({ status: "valid", plan: expected.plan });
}
