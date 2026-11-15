import { resolveNarrativeScope } from "./crossBookScope";

function expect(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const progress = { mistborn1: 12, stormlight1: 8 };

const scoped = resolveNarrativeScope({ bookId: "mistborn1", chapter: 12 }, progress);
expect(scoped.allowed && scoped.bookId === "mistborn1", "explicit reached scope must pass");

const future = resolveNarrativeScope({ bookId: "mistborn1", chapter: 13 }, progress);
expect(!future.allowed && future.reason === "future-chapter", "future chapters must fail closed");

const missing = resolveNarrativeScope({}, progress);
expect(!missing.allowed && missing.reason === "missing-book", "ambiguous cross-book requests must fail closed");

const unknown = resolveNarrativeScope({ bookId: "unknown" }, progress);
expect(!unknown.allowed && unknown.reason === "unknown-book", "unknown books must fail closed");
