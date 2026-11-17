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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validChapter(value: unknown): value is number {
  return typeof value === "number"
    && Number.isInteger(value)
    && Number.isFinite(value)
    && value >= 1
    && value <= MAX_CHAPTER;
}

/**
 * Canonicalizes metadata-only evidence provenance.
 *
 * source identifies where an original editorial summary was checked.
 * unlock identifies the earliest reader position at which the complete
 * summary is safe to reveal. The unlock must be in the same work and cannot
 * precede the cited source chapter.
 */
export function canonicalEvidenceScope(
  sourceInput: unknown,
  unlockInput: unknown,
): CanonicalHoidEvidenceScope | null {
  if (!isRecord(sourceInput) || !isRecord(unlockInput)) return null;

  const sourceBookId = typeof sourceInput.bookId === "string" ? sourceInput.bookId.trim() : "";
  const unlockBookId = typeof unlockInput.bookId === "string" ? unlockInput.bookId.trim() : "";
  const sourceChapter = sourceInput.chapter;
  const unlockChapter = unlockInput.chapter;
  const locatorId = typeof sourceInput.locatorId === "string" ? sourceInput.locatorId.trim() : "";

  if (!sourceBookId || !unlockBookId) return null;
  if (!isKnownHoidSource(sourceBookId) || !isKnownHoidSource(unlockBookId)) return null;
  if (sourceBookId !== unlockBookId) return null;
  if (!validChapter(sourceChapter) || !validChapter(unlockChapter)) return null;
  if (unlockChapter < sourceChapter) return null;
  if (!locatorId || locatorId.length > MAX_LOCATOR_LENGTH) return null;
  if (/[\u0000-\u001F\u007F]/u.test(locatorId)) return null;

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
