import { canonicalizeHoidAnswerBookScope, type HoidAnswerBookScope } from "./answerScope";
import {
  validateHoidChapterReference,
  type HoidChapterReference,
} from "./chapterReference";

const MAX_CHAPTER_REFERENCES = 64;

/**
 * Canonicalizes exact, edition-bound chapter anchors for a conversational
 * follow-up. This is a retrieval constraint only: it never unlocks evidence.
 */
export function canonicalizeHoidChapterEvidenceScope(
  value: unknown,
  bookScopeInput: HoidAnswerBookScope | undefined,
): readonly HoidChapterReference[] | null {
  const bookScope = canonicalizeHoidAnswerBookScope(bookScopeInput);
  if (!bookScope) return null;

  try {
    if (
      !Array.isArray(value) ||
      value.length < bookScope.bookIds.length ||
      value.length > MAX_CHAPTER_REFERENCES ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) return null;

    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;

    const references: HoidChapterReference[] = [];
    const identities = new Set<string>();
    const representedBooks = new Set<string>();
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;

      const validation = validateHoidChapterReference(descriptor.value);
      if (validation.status !== "valid" || validation.reference.labelAmbiguous) return null;
      const reference = validation.reference;
      if (!bookScope.bookIds.includes(reference.bookId)) return null;

      const identity = reference.bookId + "\n" + reference.unitId;
      if (identities.has(identity)) return null;
      identities.add(identity);
      representedBooks.add(reference.bookId);
      references.push(reference);
    }

    for (const key of keys) {
      if (key === "length") continue;
      if (
        typeof key !== "string" ||
        !/^(0|[1-9][0-9]*)$/u.test(key) ||
        Number(key) >= value.length
      ) return null;
    }

    if (
      representedBooks.size !== bookScope.bookIds.length ||
      !bookScope.bookIds.every(bookId => representedBooks.has(bookId))
    ) return null;

    references.sort((left, right) =>
      left.bookId < right.bookId ? -1 :
      left.bookId > right.bookId ? 1 :
      left.ordinal - right.ordinal
    );
    return Object.freeze(references);
  } catch {
    return null;
  }
}

/** True only when an evidence source is one of the exact, validated anchors. */
export function isHoidEvidenceInChapterScope(
  sourceBookId: string,
  sourceChapter: number,
  chapterScope: readonly HoidChapterReference[],
): boolean {
  return chapterScope.some(reference =>
    reference.bookId === sourceBookId &&
    reference.chapterNumber === sourceChapter &&
    reference.labelAmbiguous === false
  );
}
