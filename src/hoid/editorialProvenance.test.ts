import {
  DEFAULT_MAX_EDITORIAL_RECORD_TEXT_LENGTH,
  authorizedEditorialRecords,
} from "./contracts";

/** Regression checks for the spoiler-safe editorial provenance boundary. */
export function editorialProvenanceInvariants(): void {
  const catalog = [{ id: "book-a", title: "Book A" }, { id: "book-b", title: "Book B" }];
  const progress = { "book-a": 4, "book-b": 0 };

  const accepted = authorizedEditorialRecords([{
    id: "safe",
    bookId: "book-a",
    chapterStart: 1,
    chapterEnd: 2,
    spoilerCeiling: 4,
    text: "Original synthetic editorial summary.",
    provenance: "editorial",
  }], progress, catalog);
  if (accepted.length !== 1) throw new Error("Progress must authorize an in-scope editorial record.");

  const crossBook = authorizedEditorialRecords([{
    id: "other-work",
    bookId: "book-b",
    chapterStart: 0,
    chapterEnd: 0,
    spoilerCeiling: 1,
    text: "Synthetic cross-work summary.",
    provenance: "editorial",
  }], progress, catalog);
  if (crossBook.length !== 0) throw new Error("Progress in one work must not authorize another work.");

  const ambiguous = authorizedEditorialRecords([
    { id: "same", bookId: "book-a", chapterStart: 0, chapterEnd: 0, spoilerCeiling: 0, text: "First synthetic record.", provenance: "editorial" },
    { id: "same", bookId: "book-a", chapterStart: 0, chapterEnd: 0, spoilerCeiling: 0, text: "Second synthetic record.", provenance: "editorial" },
  ], progress, catalog);
  if (ambiguous.length !== 0) throw new Error("Duplicate editorial identifiers must fail closed.");

  const oversized = authorizedEditorialRecords([{
    id: "oversized",
    bookId: "book-a",
    chapterStart: 0,
    chapterEnd: 0,
    spoilerCeiling: 0,
    text: "x".repeat(DEFAULT_MAX_EDITORIAL_RECORD_TEXT_LENGTH + 1),
    provenance: "editorial",
  }], progress, catalog);
  if (oversized.length !== 0) throw new Error("Oversized editorial records must be rejected.");
}
