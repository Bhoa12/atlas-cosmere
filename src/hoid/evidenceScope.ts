import { isKnownHoidSource } from "./bibliography";
import type { HoidKnowledgeEntry } from "./catalog";
import type { ReadingPosition } from "./types";
import { validEditionBoundReadingPositions } from "./editionProgressValidation";
import { getHoidReadingManifest } from "./readingManifest";

export type HoidEvidenceCitation = Readonly<{
  evidenceId: string;
  sourceBookId: string;
  sourceChapter: number;
  locatorId: string;
  unlockBookId: string;
  unlockChapter: number;
}>;

export type CanonicalHoidEvidenceScope = Readonly<{
  sourceBookId: string;
  sourceChapter: number;
  locatorId: string;
  unlockBookId: string;
  unlockChapter: number;
}>;

const MAX_CHAPTER = 100_000_000;
const MAX_LOCATOR_LENGTH = 256;

function canonicalDataRecord(
  value: unknown,
  expectedKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== expectedKeys.length) return null;

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !expectedKeys.includes(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    for (const key of expectedKeys) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    }
    return result;
  } catch {
    return null;
  }
}

function validChapter(value: unknown): value is number {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= 1
    && value <= MAX_CHAPTER;
}

/**
 * Canonicalizes metadata-only evidence provenance.
 *
 * source identifies where an original editorial summary was checked.
 * unlock identifies the earliest reader position at which the complete
 * summary is safe to reveal. The unlock is a completed-through watermark in
 * the same work and cannot precede the cited source chapter.
 */
export function canonicalEvidenceScope(
  sourceInput: unknown,
  unlockInput: unknown,
): CanonicalHoidEvidenceScope | null {
  const sourceRecord = canonicalDataRecord(sourceInput, ["bookId", "chapter", "locatorId"]);
  const unlockRecord = canonicalDataRecord(unlockInput, ["bookId", "chapter"]);
  if (!sourceRecord || !unlockRecord) return null;

  const sourceBookId = typeof sourceRecord.bookId === "string" ? sourceRecord.bookId.trim() : "";
  const unlockBookId = typeof unlockRecord.bookId === "string" ? unlockRecord.bookId.trim() : "";
  const sourceChapter = sourceRecord.chapter;
  const unlockChapter = unlockRecord.chapter;
  const locatorId = typeof sourceRecord.locatorId === "string" ? sourceRecord.locatorId.trim() : "";

  if (!sourceBookId || !unlockBookId) return null;
  if (!isKnownHoidSource(sourceBookId) || !isKnownHoidSource(unlockBookId)) return null;
  if (sourceBookId !== unlockBookId) return null;
  if (!validChapter(sourceChapter) || !validChapter(unlockChapter)) return null;
  // ReadingPosition.chapter is completed-through, while a v2 cursor stores
  // the open chapter. Source chapter N is safe at cursor N+1.
  if (unlockChapter < sourceChapter) return null;
  if (!locatorId || locatorId.length > MAX_LOCATOR_LENGTH) return null;
  if (/[\u0000-\u001F\u007F]/u.test(locatorId)) return null;

  // A plausible-looking locator is not provenance. It must match the exact
  // chapter unit in the current edition manifest, and the unlock threshold
  // must also be a real unit in that same verified numeric sequence.
  const manifestResult = getHoidReadingManifest(sourceBookId);
  if (manifestResult.status !== "ready") return null;
  const sourceUnit = manifestResult.manifest.units.find(unit => unit.chapterNumber === sourceChapter);
  const unlockUnit = manifestResult.manifest.units.find(unit => unit.chapterNumber === unlockChapter);
  if (!sourceUnit || !unlockUnit || sourceUnit.locatorId !== locatorId) return null;

  return Object.freeze({
    sourceBookId,
    sourceChapter,
    locatorId,
    unlockBookId,
    unlockChapter,
  });
}

/** True only when the complete summary's explicit spoiler ceiling is reached. */
export function isEvidenceUnlocked(
  entry: HoidKnowledgeEntry,
  reading: readonly ReadingPosition[],
): boolean {
  const scope = canonicalEvidenceScope(entry.evidenceSource, entry.evidenceUnlock);
  if (!scope) return false;

  // Validate at this public boundary as well as in the runtime. In particular,
  // duplicate book positions are ambiguous and must never unlock evidence.
  const canonicalReading = validEditionBoundReadingPositions(reading);
  if (!canonicalReading) return false;
  const position = canonicalReading.find(item => item.bookId === scope.unlockBookId);
  return Boolean(
    position
    && (position.completed === true
      || (typeof position.chapter === "number" && position.chapter >= scope.unlockChapter)),
  );
}

/** Metadata-only citation emitted with an authorized answer for audit/UI use. */
export function evidenceCitationFor(
  entry: HoidKnowledgeEntry,
): HoidEvidenceCitation | null {
  const scope = canonicalEvidenceScope(entry.evidenceSource, entry.evidenceUnlock);
  if (!scope) return null;

  return Object.freeze({
    evidenceId: entry.id,
    ...scope,
  });
}
