import { isKnownHoidSource } from "./bibliography";
import { resolveHoidChapterIdentity } from "./chapterIdentity";
import { validEditionBoundReadingPositions } from "./editionProgressValidation";
import { sha256Hex } from "./sha256";

export type HoidSpoilerDependencyRequirement = Readonly<{
  bookId: string;
  /** Minimum completed-through chapter watermark, not the currently open chapter. */
  completedThroughChapter: number;
  /** Exact edition identity resolved from the verified reading manifest. */
  manifestId: string;
  editionId: string;
  navigationSha256: string;
  unitId: string;
  locatorId: string;
}>;

export type HoidSpoilerDependencySet = Readonly<{
  schemaVersion: 1;
  kind: "cross-work-explanation";
  id: string;
  requirements: readonly HoidSpoilerDependencyRequirement[];
  fingerprint: string;
}>;

export type HoidSpoilerDependencyBuildResult =
  | Readonly<{ status: "ready"; dependencySet: HoidSpoilerDependencySet }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-shape"
        | "invalid-id"
        | "invalid-kind"
        | "invalid-requirements"
        | "invalid-requirement-count"
        | "unknown-work"
        | "invalid-chapter"
        | "ambiguous-chapter"
        | "chapter-not-found"
        | "duplicate-work";
    }>;

export type HoidSpoilerDependencyValidation =
  | Readonly<{ status: "valid"; dependencySet: HoidSpoilerDependencySet }>
  | Readonly<{
      status: "invalid";
      reason: "invalid-shape" | "invalid-dependency-set" | "fingerprint-mismatch";
    }>;

export type HoidSpoilerDependencyEvaluation =
  | Readonly<{ status: "ready"; dependencyFingerprint: string }>
  | Readonly<{
      status: "withheld";
      reason: "prerequisite-not-reached";
      missingRequirementCount: number;
      dependencyFingerprint: string;
    }>
  | Readonly<{
      status: "invalid";
      reason: "invalid-dependency-set" | "invalid-progress";
    }>;

const MAX_REQUIREMENTS = 24;
const MAX_CHAPTER = 100_000_000;
const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const SHA_PATTERN = /^[a-f0-9]{64}$/u;
const STORED_REQUIREMENT_KEYS = [
  "bookId",
  "completedThroughChapter",
  "manifestId",
  "editionId",
  "navigationSha256",
  "unitId",
  "locatorId",
] as const;

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
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    for (const key of keys) if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    return result;
  } catch {
    return null;
  }
}

function denseArray(value: unknown, minimum: number, maximum: number): readonly unknown[] | null {
  try {
    if (
      !Array.isArray(value) ||
      value.length < minimum ||
      value.length > maximum ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) return null;

    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
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

function canonicalId(value: unknown): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    value === value.trim() &&
    ID_PATTERN.test(value);
}

function positiveChapter(value: unknown): value is number {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= MAX_CHAPTER;
}

function fingerprintFor(
  id: string,
  requirements: readonly HoidSpoilerDependencyRequirement[],
): string {
  return sha256Hex(JSON.stringify([
    "hoid-spoiler-dependency-set-v1",
    id,
    requirements.map(item => [
      item.bookId,
      item.completedThroughChapter,
      item.manifestId,
      item.editionId,
      item.navigationSha256,
      item.unitId,
      item.locatorId,
    ]),
  ]));
}

/**
 * Build a provider-neutral prerequisite contract for a cross-work explanation.
 *
 * Every prerequisite is bound to a known work and a uniquely resolvable,
 * edition-verified chapter identity. Ambiguous chapter labels (for example,
 * repeated labels in Viento y Verdad) are rejected rather than guessed.
 */
export function buildHoidSpoilerDependencySet(input: unknown): HoidSpoilerDependencyBuildResult {
  const raw = exactRecord(input, ["schemaVersion", "kind", "id", "requirements"]);
  if (!raw) return Object.freeze({ status: "invalid", reason: "invalid-shape" });
  if (raw.schemaVersion !== 1) return Object.freeze({ status: "invalid", reason: "invalid-shape" });
  if (raw.kind !== "cross-work-explanation") return Object.freeze({ status: "invalid", reason: "invalid-kind" });
  if (!canonicalId(raw.id)) return Object.freeze({ status: "invalid", reason: "invalid-id" });

  const entries = denseArray(raw.requirements, 2, MAX_REQUIREMENTS);
  if (!entries) {
    return Object.freeze({
      status: "invalid",
      reason: Array.isArray(raw.requirements) && raw.requirements.length < 2
        ? "invalid-requirement-count"
        : "invalid-requirements",
    });
  }

  const seenWorks = new Set<string>();
  const requirements: HoidSpoilerDependencyRequirement[] = [];
  for (const entry of entries) {
    const requirement = exactRecord(entry, ["bookId", "completedThroughChapter"]);
    if (!requirement) return Object.freeze({ status: "invalid", reason: "invalid-requirements" });

    const bookId = requirement.bookId;
    const chapter = requirement.completedThroughChapter;
    if (!canonicalId(bookId)) return Object.freeze({ status: "invalid", reason: "invalid-requirements" });
    if (!isKnownHoidSource(bookId)) return Object.freeze({ status: "invalid", reason: "unknown-work" });
    if (!positiveChapter(chapter)) return Object.freeze({ status: "invalid", reason: "invalid-chapter" });
    if (seenWorks.has(bookId)) return Object.freeze({ status: "invalid", reason: "duplicate-work" });

    const identity = resolveHoidChapterIdentity(bookId, { chapterNumber: chapter });
    if (identity.status === "ambiguous") {
      return Object.freeze({ status: "invalid", reason: "ambiguous-chapter" });
    }
    if (identity.status !== "resolved") {
      return Object.freeze({ status: "invalid", reason: "chapter-not-found" });
    }

    seenWorks.add(bookId);
    requirements.push(Object.freeze({
      bookId,
      completedThroughChapter: chapter,
      manifestId: identity.identity.manifestId,
      editionId: identity.identity.editionId,
      navigationSha256: identity.identity.navigationSha256,
      unitId: identity.identity.unitId,
      locatorId: identity.identity.locatorId,
    }));
  }

  if (seenWorks.size < 2) {
    return Object.freeze({ status: "invalid", reason: "invalid-requirement-count" });
  }

  requirements.sort((left, right) =>
    left.bookId < right.bookId ? -1 :
    left.bookId > right.bookId ? 1 :
    left.completedThroughChapter - right.completedThroughChapter
  );
  const frozenRequirements = Object.freeze(requirements);
  const dependencySet: HoidSpoilerDependencySet = Object.freeze({
    schemaVersion: 1,
    kind: "cross-work-explanation",
    id: raw.id,
    requirements: frozenRequirements,
    fingerprint: fingerprintFor(raw.id, frozenRequirements),
  });
  return Object.freeze({ status: "ready", dependencySet });
}

/** Rebuilds the canonical contract and rejects altered edition identities or fingerprints. */
export function validateHoidSpoilerDependencySet(input: unknown): HoidSpoilerDependencyValidation {
  const raw = exactRecord(input, ["schemaVersion", "kind", "id", "requirements", "fingerprint"]);
  if (!raw || typeof raw.fingerprint !== "string" || !SHA_PATTERN.test(raw.fingerprint)) {
    return Object.freeze({ status: "invalid", reason: "invalid-shape" });
  }

  const storedEntries = denseArray(raw.requirements, 2, MAX_REQUIREMENTS);
  if (!storedEntries) return Object.freeze({ status: "invalid", reason: "invalid-shape" });

  const minimalRequirements: Readonly<{ bookId: unknown; completedThroughChapter: unknown }>[] = [];
  const storedRequirements: Record<string, unknown>[] = [];
  for (const entry of storedEntries) {
    const requirement = exactRecord(entry, STORED_REQUIREMENT_KEYS);
    if (!requirement) return Object.freeze({ status: "invalid", reason: "invalid-shape" });
    minimalRequirements.push(Object.freeze({
      bookId: requirement.bookId,
      completedThroughChapter: requirement.completedThroughChapter,
    }));
    storedRequirements.push(requirement);
  }

  const rebuilt = buildHoidSpoilerDependencySet({
    schemaVersion: raw.schemaVersion,
    kind: raw.kind,
    id: raw.id,
    requirements: minimalRequirements,
  });
  if (rebuilt.status !== "ready") {
    return Object.freeze({ status: "invalid", reason: "invalid-dependency-set" });
  }

  const canonical = rebuilt.dependencySet;
  const identityMatches = canonical.requirements.length === storedRequirements.length &&
    canonical.requirements.every((expected, index) => {
      const actual = storedRequirements[index];
      return actual.bookId === expected.bookId &&
        actual.completedThroughChapter === expected.completedThroughChapter &&
        actual.manifestId === expected.manifestId &&
        actual.editionId === expected.editionId &&
        actual.navigationSha256 === expected.navigationSha256 &&
        actual.unitId === expected.unitId &&
        actual.locatorId === expected.locatorId;
    });
  if (!identityMatches || canonical.fingerprint !== raw.fingerprint) {
    return Object.freeze({ status: "invalid", reason: "fingerprint-mismatch" });
  }
  return Object.freeze({ status: "valid", dependencySet: canonical });
}

/**
 * Fail-closed progress gate for cross-work context.
 *
 * ReadingPosition.chapter is interpreted as a completed-through watermark.
 * A requirement is met only when that work is explicitly completed or its
 * watermark reaches the required chapter. Missing progress never inherits
 * another book's position or the array order.
 */
export function evaluateHoidSpoilerDependencies(
  dependencySetInput: unknown,
  progressInput: unknown,
): HoidSpoilerDependencyEvaluation {
  const validation = validateHoidSpoilerDependencySet(dependencySetInput);
  if (validation.status !== "valid") {
    return Object.freeze({ status: "invalid", reason: "invalid-dependency-set" });
  }

  const progress = validEditionBoundReadingPositions(progressInput);
  if (progress === null) {
    return Object.freeze({ status: "invalid", reason: "invalid-progress" });
  }

  const byWork = new Map(progress.map(position => [position.bookId, position]));
  let missingRequirementCount = 0;
  for (const requirement of validation.dependencySet.requirements) {
    const position = byWork.get(requirement.bookId);
    const satisfied = Boolean(
      position && (
        position.completed === true ||
        (typeof position.chapter === "number" &&
          position.chapter >= requirement.completedThroughChapter)
      ),
    );
    if (!satisfied) missingRequirementCount += 1;
  }

  if (missingRequirementCount > 0) {
    return Object.freeze({
      status: "withheld",
      reason: "prerequisite-not-reached",
      missingRequirementCount,
      dependencyFingerprint: validation.dependencySet.fingerprint,
    });
  }

  return Object.freeze({
    status: "ready",
    dependencyFingerprint: validation.dependencySet.fingerprint,
  });
}
