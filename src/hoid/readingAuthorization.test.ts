import { isKnowledgeUnlocked } from "./readingAuthorization";
import { HoidKnowledgeEntry } from "./catalog";
import { ReadingPosition } from "./types";

const entry: HoidKnowledgeEntry = {
  id: "safe-entry",
  aliases: ["safe"],
  kind: "concept",
  firstSafeAppearance: { bookId: "book-a", chapter: 3 },
};

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

export function runReadingAuthorizationChecks(): void {
  assert(
    !isKnowledgeUnlocked(entry, [{ bookId: "book-a", chapter: Number.NaN }]),
    "NaN must not unlock knowledge",
  );
  assert(
    !isKnowledgeUnlocked(entry, [{ bookId: "book-a", chapter: Infinity }]),
    "Infinity must not unlock knowledge",
  );
  assert(
    !isKnowledgeUnlocked(entry, [{ bookId: "book-a", chapter: -1 }]),
    "negative chapters must not unlock knowledge",
  );
  assert(
    !isKnowledgeUnlocked(entry, [
      { bookId: "book-a", chapter: 1 },
      { bookId: "book-a", chapter: 3 },
    ]),
    "ambiguous duplicate positions must unlock nothing",
  );
  assert(
    !isKnowledgeUnlocked(entry, [{ bookId: "book-a", chapter: 3.5 }]),
    "fractional chapters must not unlock knowledge",
  );
}
