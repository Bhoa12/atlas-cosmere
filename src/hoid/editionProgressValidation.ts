import { getHoidEditionProgressPolicy } from "./editionStructure";
import { validReadingPositions } from "./readingValidation";
import type { ReadingPosition } from "./types";

/**
 * Strict progress validator for narrative authorization.
 *
 * The generic validator protects the shape of a reading snapshot. This second
 * boundary also checks the inspected edition: a chapter outside the verified
 * range, a duplicated chapter number without a locator, or a numeric cursor
 * for an unsegmented collection must never unlock evidence.
 *
 * Unknown works are ignored because they are outside Hoid's declared source
 * bibliography. Invalid progress for a known work rejects the whole snapshot.
 */
export function validEditionBoundReadingPositions(value: unknown): ReadingPosition[] | null {
  const structurallyValid = validReadingPositions(value);
  if (structurallyValid === null) return null;

  const authorized: ReadingPosition[] = [];

  for (const position of structurallyValid) {
    const policy = getHoidEditionProgressPolicy(position.bookId);
    if (policy.kind === "unknown") continue;

    if (position.completed === true) {
      authorized.push(Object.freeze({ bookId: position.bookId, completed: true }));
      continue;
    }

    const chapter = position.chapter;
    if (typeof chapter !== "number" || !Number.isSafeInteger(chapter) || chapter < 1) {
      return null;
    }

    if (policy.kind === "numeric-chapters") {
      if (chapter > policy.chapterCount) return null;
      authorized.push(Object.freeze({ bookId: position.bookId, chapter }));
      continue;
    }

    if (policy.kind === "chapter-number-with-duplicate-locators") {
      if (chapter > policy.safeNumericProgressThroughChapter) return null;
      authorized.push(Object.freeze({ bookId: position.bookId, chapter }));
      continue;
    }

    // A numeric chapter cannot identify a position inside a merged multi-volume
    // edition or a collection whose chapter numbering restarts per included work.
    return null;
  }

  return authorized;
}
