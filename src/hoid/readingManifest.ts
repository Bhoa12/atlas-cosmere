import { HOID_EDITION_STRUCTURES } from "./editionStructure";
import type { ReadingPosition } from "./types";

export type HoidReadingUnit = Readonly<{
  id: string;
  kind: "chapter";
  ordinal: number;
  chapterNumber: number;
}>;

export type HoidReadingManifest = Readonly<{
  manifestId: string;
  editionId: string;
  navigationSha256: string;
  bookId: string;
  /** This manifest describes numbered chapters only, not all EPUB sections. */
  unitScope: "numbered-chapters-only";
  coverage: "verified-numeric-chapters" | "partial-before-ambiguous-chapter";
  units: readonly HoidReadingUnit[];
  ambiguousChapterNumbers: readonly number[];
}>;

export type HoidReadingManifestResult =
  | Readonly<{ status: "ready"; manifest: HoidReadingManifest }>
  | Readonly<{
      status: "unavailable";
      reason: "unknown-work" | "segmentation-unverified";
      editionId?: string;
    }>;

export type HoidReadingCursor = Readonly<{
  schemaVersion: 1;
  manifestId: string;
  bookId: string;
  unitId: string;
  ordinal: number;
  chapterNumber: number;
}>;

export type HoidReadingCursorCreation =
  | Readonly<{ status: "ready"; cursor: HoidReadingCursor }>
  | Readonly<{
      status: "unavailable";
      reason: "unknown-work" | "segmentation-unverified" | "unit-not-found";
    }>;

export type HoidReadingCursorValidation =
  | Readonly<{
      status: "valid";
      cursor: HoidReadingCursor;
      manifest: HoidReadingManifest;
    }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-shape"
        | "unknown-work"
        | "segmentation-unverified"
        | "manifest-mismatch"
        | "unit-not-found";
    }>;

const MAX_MANIFEST_UNITS = 10_000;
const CURSOR_KEYS = new Set([
  "schemaVersion",
  "manifestId",
  "bookId",
  "unitId",
  "ordinal",
  "chapterNumber",
]);

function chapterUnitId(chapterNumber: number): string {
  return `chapter:${String(chapterNumber).padStart(3, "0")}`;
}

/**
 * Builds a metadata-only manifest from the inspected edition structure.
 *
 * No chapter titles, EPUB paths, prose, or inferred special sections are
 * created here. Duplicate-number editions expose only the unambiguous prefix.
 * Merged volumes and collections remain unavailable until their TOCs have
 * been inspected and segmented independently.
 */
export function getHoidReadingManifest(bookId: unknown): HoidReadingManifestResult {
  if (
    typeof bookId !== "string" ||
    bookId.length === 0 ||
    bookId.length > 256 ||
    bookId !== bookId.trim()
  ) {
    return Object.freeze({ status: "unavailable", reason: "unknown-work" });
  }

  for (const source of HOID_EDITION_STRUCTURES) {
    const work = source.works.find(candidate => candidate.workIds.includes(bookId));
    if (!work) continue;

    let lastSafeChapter: number;
    let coverage: HoidReadingManifest["coverage"];
    let ambiguousChapterNumbers: readonly number[] = Object.freeze([]);

    if (work.mode === "numeric-chapters") {
      lastSafeChapter = work.chapterCount ?? 0;
      coverage = "verified-numeric-chapters";
    } else if (work.mode === "chapter-number-with-duplicate-locators") {
      const duplicates = work.duplicateChapterNumbers ?? [];
      if (duplicates.length === 0) {
        return Object.freeze({
          status: "unavailable",
          reason: "segmentation-unverified",
          editionId: source.editionId,
        });
      }
      lastSafeChapter = Math.min(...duplicates) - 1;
      coverage = "partial-before-ambiguous-chapter";
      ambiguousChapterNumbers = Object.freeze([...duplicates]);
    } else {
      return Object.freeze({
        status: "unavailable",
        reason: "segmentation-unverified",
        editionId: source.editionId,
      });
    }

    if (
      !Number.isSafeInteger(lastSafeChapter) ||
      lastSafeChapter < 1 ||
      lastSafeChapter > MAX_MANIFEST_UNITS
    ) {
      return Object.freeze({
        status: "unavailable",
        reason: "segmentation-unverified",
        editionId: source.editionId,
      });
    }

    const units: HoidReadingUnit[] = [];
    for (let chapterNumber = 1; chapterNumber <= lastSafeChapter; chapterNumber += 1) {
      units.push(Object.freeze({
        id: chapterUnitId(chapterNumber),
        kind: "chapter" as const,
        ordinal: chapterNumber,
        chapterNumber,
      }));
    }

    const manifestId = `hoid:${source.editionId}:${bookId}:${source.navigationSha256}`;
    const manifest: HoidReadingManifest = Object.freeze({
      manifestId,
      editionId: source.editionId,
      navigationSha256: source.navigationSha256,
      bookId,
      unitScope: "numbered-chapters-only",
      coverage,
      units: Object.freeze(units),
      ambiguousChapterNumbers,
    });

    return Object.freeze({ status: "ready", manifest });
  }

  return Object.freeze({ status: "unavailable", reason: "unknown-work" });
}

export function createHoidReadingCursor(
  bookId: unknown,
  chapterNumber: unknown,
): HoidReadingCursorCreation {
  const result = getHoidReadingManifest(bookId);
  if (result.status !== "ready") {
    return Object.freeze({
      status: "unavailable",
      reason: result.reason,
    });
  }
  if (
    typeof chapterNumber !== "number" ||
    !Number.isSafeInteger(chapterNumber) ||
    chapterNumber < 1
  ) {
    return Object.freeze({ status: "unavailable", reason: "unit-not-found" });
  }

  const unit = result.manifest.units.find(candidate => candidate.chapterNumber === chapterNumber);
  if (!unit) return Object.freeze({ status: "unavailable", reason: "unit-not-found" });

  return Object.freeze({
    status: "ready",
    cursor: Object.freeze({
      schemaVersion: 1,
      manifestId: result.manifest.manifestId,
      bookId: result.manifest.bookId,
      unitId: unit.id,
      ordinal: unit.ordinal,
      chapterNumber: unit.chapterNumber,
    }),
  });
}

function canonicalCursorRecord(value: unknown): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const keys = Reflect.ownKeys(value);
    if (keys.length !== CURSOR_KEYS.size) return null;

    const record = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !CURSOR_KEYS.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      record[key] = descriptor.value;
    }
    for (const key of CURSOR_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(record, key)) return null;
    }
    return record;
  } catch {
    return null;
  }
}

/** Validate an untrusted cursor against the exact edition manifest. */
export function validateHoidReadingCursor(value: unknown): HoidReadingCursorValidation {
  const record = canonicalCursorRecord(value);
  if (record === null) return Object.freeze({ status: "invalid", reason: "invalid-shape" });

  if (
    record.schemaVersion !== 1 ||
    typeof record.manifestId !== "string" ||
    typeof record.bookId !== "string" ||
    typeof record.unitId !== "string" ||
    typeof record.ordinal !== "number" ||
    !Number.isSafeInteger(record.ordinal) ||
    record.ordinal < 1 ||
    typeof record.chapterNumber !== "number" ||
    !Number.isSafeInteger(record.chapterNumber) ||
    record.chapterNumber < 1
  ) {
    return Object.freeze({ status: "invalid", reason: "invalid-shape" });
  }

  const manifestResult = getHoidReadingManifest(record.bookId);
  if (manifestResult.status !== "ready") {
    return Object.freeze({
      status: "invalid",
      reason: manifestResult.reason,
    });
  }
  const manifest = manifestResult.manifest;
  if (record.manifestId !== manifest.manifestId) {
    return Object.freeze({ status: "invalid", reason: "manifest-mismatch" });
  }

  const unit = manifest.units.find(candidate =>
    candidate.id === record.unitId &&
    candidate.ordinal === record.ordinal &&
    candidate.chapterNumber === record.chapterNumber
  );
  if (!unit) return Object.freeze({ status: "invalid", reason: "unit-not-found" });

  const cursor: HoidReadingCursor = Object.freeze({
    schemaVersion: 1,
    manifestId: manifest.manifestId,
    bookId: manifest.bookId,
    unitId: unit.id,
    ordinal: unit.ordinal,
    chapterNumber: unit.chapterNumber,
  });
  return Object.freeze({ status: "valid", cursor, manifest });
}

/**
 * Compatibility projection for the current chapter-based EvidenceRuntime.
 * Only a cursor that validates against its edition manifest can be projected.
 */
export function cursorToLegacyReadingPosition(value: unknown): ReadingPosition | null {
  const result = validateHoidReadingCursor(value);
  if (result.status !== "valid") return null;
  return Object.freeze({
    bookId: result.cursor.bookId,
    chapter: result.cursor.chapterNumber,
  });
}
