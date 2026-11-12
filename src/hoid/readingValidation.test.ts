import {
  DEFAULT_MAX_READING_POSITION_BOOK_ID_LENGTH,
  DEFAULT_MAX_READING_POSITIONS,
  validReadingPositions,
} from "./readingValidation";

describe("validReadingPositions", () => {
  it("rejects a non-array reading state", () => {
    expect(validReadingPositions({})).toBeNull();
  });

  it("drops malformed positions without granting progress", () => {
    expect(validReadingPositions([
      null,
      {},
      { bookId: "mistborn", chapter: -1 },
      { bookId: "mistborn", chapter: Number.POSITIVE_INFINITY },
      { bookId: "mistborn", chapter: 4 },
    ])).toEqual([{ bookId: "mistborn", chapter: 4 }]);
  });

  it("drops oversized book identifiers before they can authorize progress", () => {
    const oversizedBookId = "x".repeat(DEFAULT_MAX_READING_POSITION_BOOK_ID_LENGTH + 1);
    expect(validReadingPositions([
      { bookId: oversizedBookId, chapter: 999 },
      { bookId: "mistborn", chapter: 4 },
    ])).toEqual([{ bookId: "mistborn", chapter: 4 }]);
  });

  it("preserves only explicit, conservative completion", () => {
    expect(validReadingPositions([
      { bookId: "roshar", completed: "yes" },
      { bookId: "roshar", completed: true },
    ])).toEqual([{ bookId: "roshar", completed: true }]);
  });

  it("fails closed when two valid positions target the same book", () => {
    expect(validReadingPositions([
      { bookId: "mistborn", chapter: 2 },
      { bookId: "mistborn", chapter: 8 },
    ])).toBeNull();
  });

  it("does not merge completion with another position for the same book", () => {
    expect(validReadingPositions([
      { bookId: "roshar", chapter: 10 },
      { bookId: "roshar", completed: true },
    ])).toBeNull();
  });

  it("fails closed on oversized progress payloads instead of truncating by input order", () => {
    const payload = Array.from({ length: DEFAULT_MAX_READING_POSITIONS + 1 }, (_, index) => ({
      bookId: `book-${index}`,
      chapter: 1,
    }));
    expect(validReadingPositions(payload)).toBeNull();
  });
});
