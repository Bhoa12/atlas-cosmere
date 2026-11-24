import {
  createHoidChapterReference,
  validateHoidChapterReference,
  type HoidChapterReference,
} from "./chapterReference";
import { getHoidReadingManifest, type HoidReadingManifest } from "./readingManifest";
import type { ReadingPosition } from "./types";

/**
 * An edition-bound cursor over one exact numbered chapter unit.
 *
 * Unlike the legacy numeric cursor, this contract can identify a duplicated
 * chapter label by its exact unit reference. It is accepted only when every
 * preceding ordinal exists in the current manifest. It is not yet a durable
 * ledger format and does not itself authorize narrative evidence.
 */
export type HoidUnitProgressCursor = Readonly<{
  schemaVersion: 1;
  kind: "unit-progress-cursor";
  reference: HoidChapterReference;
}>;

export type HoidUnitProgressBoundary = Readonly<{
  bookId: string;
  currentUnitId: string;
  currentOrdinal: number;
  currentChapterNumber: number;
  /** Number of preceding units in the verified contiguous prefix. */
  completedThroughOrdinal: number | null;
  /**
   * Compatibility projection for the existing chapter-number evidence core.
   * It is null whenever completed units cannot be represented without
   * collapsing duplicated chapter labels into an unsafe numeric position.
   */
  legacyReadingPosition: ReadingPosition | null;
}>;

export type HoidUnitProgressCursorValidation =
  | Readonly<{
      status: "valid";
      cursor: HoidUnitProgressCursor;
      boundary: HoidUnitProgressBoundary;
    }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-shape"
        | "invalid-reference"
        | "unknown-work"
        | "segmentation-unverified"
        | "unit-not-found"
        | "non-contiguous-prefix";
    }>;

export type HoidUnitProgressCursorCreation =
  | Readonly<{
      status: "ready";
      cursor: HoidUnitProgressCursor;
      boundary: HoidUnitProgressBoundary;
    }>
  | Readonly<{
      status: "ambiguous";
      chapterNumber: number;
      candidateCount: number | null;
    }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "invalid-selection"
        | "unknown-work"
        | "segmentation-unverified"
        | "unit-not-found"
        | "non-contiguous-prefix";
    }>;

const CURSOR_KEYS = new Set(["schemaVersion", "kind", "reference"]);

function exactDataRecord(
  value: unknown,
  allowedKeys: ReadonlySet<string>,
  requiredKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const keys = Reflect.ownKeys(value);
    if (keys.length !== allowedKeys.size) return null;

    const record = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !allowedKeys.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      record[key] = descriptor.value;
    }
    for (const key of requiredKeys) {
      if (!Object.prototype.hasOwnProperty.call(record, key)) return null;
    }
    return record;
  } catch {
    return null;
  }
}

/** Find the longest manifest prefix whose ordinals are exactly 1..N. */
function contiguousVerifiedPrefix(manifest: HoidReadingManifest) {
  const ordered = [...manifest.units].sort((left, right) => left.ordinal - right.ordinal);
  const prefix = [];
  for (const unit of ordered) {
    if (unit.ordinal !== prefix.length + 1) break;
    prefix.push(unit);
  }
  return prefix;
}

function legacyProjectionForCompletedPrefix(
  manifest: HoidReadingManifest,
  completedUnits: readonly HoidReadingManifest["units"][number][],
): ReadingPosition | null {
  if (completedUnits.length === 0) return null;

  // The legacy evidence core understands chapter numbers, not unit ordinals.
  // Never collapse a completed duplicate label into a numeric grant: doing so
  // could unlock evidence belonging to a later occurrence of the same label.
  for (let index = 0; index < completedUnits.length; index += 1) {
    const unit = completedUnits[index];
    const expectedChapter = index + 1;
    if (
      unit.ordinal !== expectedChapter ||
      unit.chapterNumber !== expectedChapter ||
      manifest.ambiguousChapterNumbers.includes(unit.chapterNumber)
    ) return null;
  }

  return Object.freeze({
    bookId: manifest.bookId,
    chapter: completedUnits.length,
  });
}

function boundaryFor(
  manifest: HoidReadingManifest,
  reference: HoidChapterReference,
): HoidUnitProgressBoundary | null {
  const prefix = contiguousVerifiedPrefix(manifest);
  if (reference.ordinal > prefix.length) return null;

  const current = prefix[reference.ordinal - 1];
  if (
    !current ||
    current.id !== reference.unitId ||
    current.ordinal !== reference.ordinal ||
    current.chapterNumber !== reference.chapterNumber
  ) return null;

  const completedUnits = prefix.slice(0, reference.ordinal - 1);
  return Object.freeze({
    bookId: manifest.bookId,
    currentUnitId: current.id,
    currentOrdinal: current.ordinal,
    currentChapterNumber: current.chapterNumber,
    completedThroughOrdinal: completedUnits.length > 0 ? completedUnits.length : null,
    legacyReadingPosition: legacyProjectionForCompletedPrefix(manifest, completedUnits),
  });
}

/** Create a cursor only for a unit inside the verified contiguous prefix. */
export function createHoidUnitProgressCursor(
  bookId: unknown,
  selection: unknown,
): HoidUnitProgressCursorCreation {
  const creation = createHoidChapterReference(bookId, selection);
  if (creation.status === "ambiguous") {
    return Object.freeze({
      status: "ambiguous",
      chapterNumber: creation.chapterNumber,
      candidateCount: creation.candidateCount,
    });
  }
  if (creation.status !== "ready") {
    return Object.freeze({
      status: "unavailable",
      reason: creation.reason === "unknown-work"
        ? "unknown-work"
        : creation.reason === "segmentation-unverified"
          ? "segmentation-unverified"
          : creation.reason === "invalid-selection"
            ? "invalid-selection"
            : "unit-not-found",
    });
  }

  const cursor: HoidUnitProgressCursor = Object.freeze({
    schemaVersion: 1,
    kind: "unit-progress-cursor",
    reference: creation.reference,
  });
  const validation = validateHoidUnitProgressCursor(cursor);
  if (validation.status !== "valid") {
    return Object.freeze({
      status: "unavailable",
      reason: validation.reason === "non-contiguous-prefix"
        ? "non-contiguous-prefix"
        : validation.reason === "unknown-work"
          ? "unknown-work"
          : validation.reason === "segmentation-unverified"
            ? "segmentation-unverified"
            : "unit-not-found",
    });
  }

  return Object.freeze({
    status: "ready",
    cursor: validation.cursor,
    boundary: validation.boundary,
  });
}

/**
 * Revalidate exact unit identity and require a complete ordinal prefix.
 *
 * The returned legacy projection is deliberately absent when any completed
 * unit has an ambiguous chapter label. Consumers must use the ordinal boundary
 * in a future unit-aware runtime rather than guessing a numeric equivalent.
 */
export function validateHoidUnitProgressCursor(
  value: unknown,
): HoidUnitProgressCursorValidation {
  const record = exactDataRecord(value, CURSOR_KEYS, ["schemaVersion", "kind", "reference"]);
  if (!record || record.schemaVersion !== 1 || record.kind !== "unit-progress-cursor") {
    return Object.freeze({ status: "invalid", reason: "invalid-shape" });
  }

  const referenceResult = validateHoidChapterReference(record.reference);
  if (referenceResult.status !== "valid") {
    const reason = referenceResult.reason === "unknown-work"
      ? "unknown-work"
      : referenceResult.reason === "segmentation-unverified"
        ? "segmentation-unverified"
        : "invalid-reference";
    return Object.freeze({ status: "invalid", reason });
  }

  const manifestResult = getHoidReadingManifest(referenceResult.reference.bookId);
  if (manifestResult.status !== "ready") {
    return Object.freeze({ status: "invalid", reason: "segmentation-unverified" });
  }

  const boundary = boundaryFor(manifestResult.manifest, referenceResult.reference);
  if (!boundary) {
    const exists = manifestResult.manifest.units.some(unit =>
      unit.id === referenceResult.reference.unitId &&
      unit.ordinal === referenceResult.reference.ordinal &&
      unit.chapterNumber === referenceResult.reference.chapterNumber
    );
    return Object.freeze({
      status: "invalid",
      reason: exists ? "non-contiguous-prefix" : "unit-not-found",
    });
  }

  const cursor: HoidUnitProgressCursor = Object.freeze({
    schemaVersion: 1,
    kind: "unit-progress-cursor",
    reference: referenceResult.reference,
  });
  return Object.freeze({ status: "valid", cursor, boundary });
}
