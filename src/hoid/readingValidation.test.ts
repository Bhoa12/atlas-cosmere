import { validReadingPositions } from "./readingValidation";

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

  it("preserves only explicit, conservative completion", () => {
    expect(validReadingPositions([
      { bookId: "roshar", completed: "yes" },
      { bookId: "roshar", completed: true },
    ])).toEqual([{ bookId: "roshar", completed: true }]);
  });
});
