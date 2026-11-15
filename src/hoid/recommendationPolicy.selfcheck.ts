import { recommendNext } from "./recommendationPolicy";

function expect(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const catalog = [
  { bookId: "mistborn-1", title: "El Imperio Final", kind: "novel" as const, order: 1 },
  { bookId: "mistborn-2", title: "El Pozo de la Ascensión", kind: "novel" as const, order: 2 },
];

const first = recommendNext([{ bookId: "mistborn-1", chapter: 1 }], catalog);
expect(first.kind === "recommend", "must recommend metadata-only candidate");
if (first.kind === "recommend") {
  expect(first.candidate.bookId === "mistborn-2", "must exclude declared book");
  expect(first.reason === "catalog-order-and-declared-progress", "reason must be non-narrative");
}

const missing = recommendNext([], catalog);
expect(missing.kind === "abstain" && missing.reason === "reading-progress-required", "must fail closed");

const malformed = recommendNext([{ bookId: "mistborn-1", chapter: 0 }], catalog);
expect(malformed.kind === "abstain", "invalid progress must be rejected");
