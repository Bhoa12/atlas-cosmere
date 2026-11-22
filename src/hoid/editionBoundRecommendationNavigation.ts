import { validateHoidCursorProgressSnapshot } from "./cursorProgressLedger";
import { fingerprintHoidCursorProgressSnapshot } from "./knowledgeGraph";
import {
  validateHoidReadingCursor,
  type HoidReadingCursor,
} from "./readingManifest";
export type HoidVerifiedRecommendationNavigationHandoff = Readonly<{
  cursor: HoidReadingCursor;
  manifestId: string;
  editionId: string;
  navigationSha256: string;
  locatorStatus: "verified" | "cursor-only";
  /** Opaque, edition-bound TOC locator; never a filesystem path or URL. */
  locatorId?: string;
}>;

export type HoidRecommendationNavigationHandoffResult =
  | Readonly<{
      status: "ready";
      handoff: HoidVerifiedRecommendationNavigationHandoff;
      progressRevision: number;
      progressFingerprint: string;
    }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "invalid-progress"
        | "invalid-progress-identity"
        | "stale-progress"
        | "invalid-target"
        | "catalog-only"
        | "manifest-mismatch"
        | "locator-mismatch"
        | "work-completed"
        | "work-not-started"
        | "cursor-mismatch"
        | "selection-required"
        | "invalid-active-work";
    }>;

const TARGET_KEYS = new Set([
  "kind",
  "cursor",
  "editionId",
  "navigationSha256",
  "locatorStatus",
  "locatorId",
  "reason",
]);
const REQUIRED_CURSOR_TARGET_KEYS = new Set([
  "kind",
  "cursor",
  "editionId",
  "navigationSha256",
  "locatorStatus",
]);

function unavailable(
  reason: Extract<HoidRecommendationNavigationHandoffResult, { status: "unavailable" }>["reason"],
): HoidRecommendationNavigationHandoffResult {
  return Object.freeze({ status: "unavailable", reason });
}

/**
 * Copy a plain data record without invoking accessors. Proxy traps are caught
 * and the caller-owned object is never read again after this canonical copy.
 */
function canonicalTargetRecord(value: unknown): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const keys = Reflect.ownKeys(value);
    if (keys.length < 2 || keys.length > 6) return null;

    const record = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !TARGET_KEYS.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      record[key] = descriptor.value;
    }
    return record;
  } catch {
    return null;
  }
}

function sameCursor(left: HoidReadingCursor, right: HoidReadingCursor): boolean {
  return left.schemaVersion === right.schemaVersion &&
    left.manifestId === right.manifestId &&
    left.bookId === right.bookId &&
    left.unitId === right.unitId &&
    left.ordinal === right.ordinal &&
    left.chapterNumber === right.chapterNumber;
}

/**
 * Revalidate an edition-bound recommendation immediately before a future
 * reader host consumes it.
 *
 * The expected revision/fingerprint must come from the presentation that
 * produced the target. The live progress snapshot is canonicalized once; its
 * exact identity is compared before the target is checked against the current
 * manifest and the reader's current cursor.
 *
 * A ready result is a metadata-only handoff, not a navigation side effect.
 * This module never opens a chapter, changes progress, reads EPUB bytes,
 * authorizes narrative evidence, or treats a TOC locator as a chapter-body
 * digest. The host must resolve the opaque locator within the exact edition.
 */
export function prepareHoidRecommendationNavigationHandoff(
  targetInput: unknown,
  progressInput: unknown,
  expectedProgressRevision: unknown,
  expectedProgressFingerprint: unknown,
  selectedActiveBookId?: unknown,
): HoidRecommendationNavigationHandoffResult {
  const validation = validateHoidCursorProgressSnapshot(progressInput);
  if (validation.status !== "valid") return unavailable("invalid-progress");

  if (
    typeof expectedProgressRevision !== "number" ||
    !Number.isSafeInteger(expectedProgressRevision) ||
    expectedProgressRevision < 0 ||
    typeof expectedProgressFingerprint !== "string" ||
    !/^[a-f0-9]{64}$/.test(expectedProgressFingerprint)
  ) return unavailable("invalid-progress-identity");

  const snapshot = validation.snapshot;
  const identity = fingerprintHoidCursorProgressSnapshot(snapshot);
  if (identity.status !== "ready") return unavailable("invalid-progress");
  if (
    identity.revision !== expectedProgressRevision ||
    identity.sha256 !== expectedProgressFingerprint
  ) return unavailable("stale-progress");

  const record = canonicalTargetRecord(targetInput);
  if (record === null) return unavailable("invalid-target");

  if (record.kind === "catalog-only") {
    if (
      Object.keys(record).length !== 2 ||
      (record.reason !== "segmentation-unverified" && record.reason !== "unit-not-found")
    ) return unavailable("invalid-target");
    return unavailable("catalog-only");
  }

  if (
    record.kind !== "edition-cursor" ||
    REQUIRED_CURSOR_TARGET_KEYS.some(key => !Object.prototype.hasOwnProperty.call(record, key)) ||
    Object.keys(record).some(key => !REQUIRED_CURSOR_TARGET_KEYS.has(key) && key !== "locatorId") ||
    (Object.prototype.hasOwnProperty.call(record, "reason"))
  ) return unavailable("invalid-target");

  const cursorValidation = validateHoidReadingCursor(record.cursor);
  if (cursorValidation.status !== "valid") return unavailable("invalid-target");

  const cursor = cursorValidation.cursor;
  const manifest = cursorValidation.manifest;
  if (
    typeof record.editionId !== "string" ||
    typeof record.navigationSha256 !== "string" ||
    record.editionId !== manifest.editionId ||
    record.navigationSha256 !== manifest.navigationSha256
  ) return unavailable("manifest-mismatch");

  const unit = manifest.units.find(candidate =>
    candidate.id === cursor.unitId &&
    candidate.ordinal === cursor.ordinal &&
    candidate.chapterNumber === cursor.chapterNumber
  );
  if (!unit) return unavailable("manifest-mismatch");

  if (unit.locatorId) {
    if (
      record.locatorStatus !== "verified" ||
      record.locatorId !== unit.locatorId ||
      typeof record.locatorId !== "string"
    ) return unavailable("locator-mismatch");
  } else if (
    record.locatorStatus !== "cursor-only" ||
    Object.prototype.hasOwnProperty.call(record, "locatorId")
  ) {
    return unavailable("locator-mismatch");
  }

  const inProgress = snapshot.positions.filter(
    (candidate): candidate is Extract<typeof candidate, { cursor: HoidReadingCursor }> =>
      "cursor" in candidate,
  );
  if (
    selectedActiveBookId !== undefined &&
    (typeof selectedActiveBookId !== "string" ||
      !inProgress.some(candidate => candidate.bookId === selectedActiveBookId))
  ) return unavailable("invalid-active-work");
  if (inProgress.length > 1 && selectedActiveBookId === undefined) {
    return unavailable("selection-required");
  }

  const position = snapshot.positions.find(candidate => candidate.bookId === cursor.bookId);
  if (position) {
    if ("completed" in position) return unavailable("work-completed");
    if (inProgress.length > 1 && cursor.bookId !== selectedActiveBookId) {
      return unavailable("selection-required");
    }
    if (!sameCursor(position.cursor, cursor)) return unavailable("cursor-mismatch");
  } else if (cursor.chapterNumber !== 1) {
    return unavailable("work-not-started");
  }

  const handoff: HoidVerifiedRecommendationNavigationHandoff = Object.freeze({
    cursor,
    manifestId: manifest.manifestId,
    editionId: manifest.editionId,
    navigationSha256: manifest.navigationSha256,
    locatorStatus: unit.locatorId ? "verified" : "cursor-only",
    ...(unit.locatorId ? { locatorId: unit.locatorId } : {}),
  });

  return Object.freeze({
    status: "ready",
    handoff,
    progressRevision: identity.revision,
    progressFingerprint: identity.sha256,
  });
}
