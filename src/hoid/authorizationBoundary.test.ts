import { HoidKnowledgeEntry } from "./catalog";
import { ReadingPosition } from "./types";
import { authorizeReading, authorizedBookIds } from "./authorizationBoundary";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const knowledge: HoidKnowledgeEntry[] = [
  { id: "a", aliases: ["a"], kind: "concept", firstSafeAppearance: { bookId: "book-a", chapter: 1 } },
  { id: "b", aliases: ["b"], kind: "concept", firstSafeAppearance: { bookId: "book-b", chapter: 1 } },
];

export function runAuthorizationBoundaryChecks(): void {
  const raw: ReadingPosition[] = [
    { bookId: "book-a", chapter: 2 },
    { bookId: "unknown", chapter: 999 },
    { bookId: "book-a", chapter: Number.NaN },
    { bookId: "", chapter: 5 },
  ];

  const canonical = authorizeReading(raw, new Set(["book-a", "book-b"]));
  assert(canonical.length === 1, "only valid known progress must cross the boundary");
  assert(canonical[0].bookId === "book-a" && canonical[0].chapter === 2, "valid progress must be preserved");

  const ids = authorizedBookIds(knowledge, raw);
  assert(ids.size === 1 && ids.has("book-a"), "unknown books must never become authorized");
}
