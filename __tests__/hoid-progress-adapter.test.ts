import { toHoidReadingPositions } from "../src/hoid/progressAdapter";

describe("Hoid progress adapter", () => {
  it("converts chapter and completion records without importing UI state", () => {
    expect(toHoidReadingPositions({
      chaptersByBook: { mistborn: 12 },
      completedByBook: { elantris: true },
    })).toEqual([
      { bookId: "elantris", completed: true },
      { bookId: "mistborn", chapter: 12 },
    ]);
  });

  it("omits invalid chapter values so uncertain progress is not upgraded", () => {
    expect(toHoidReadingPositions({
      chaptersByBook: { safe: Number.NaN, future: -4 },
    })).toEqual([
      { bookId: "future" },
      { bookId: "safe" },
    ]);
  });

  it("drops empty book identifiers", () => {
    expect(toHoidReadingPositions({
      completedByBook: { "": true, valid: false },
    })).toEqual([{ bookId: "valid" }]);
  });
});
