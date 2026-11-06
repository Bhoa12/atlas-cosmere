import { buildReadingContext } from "./readingContext";

describe("reading context edge cases", () => {
  it("floors fractional chapters and keeps the greatest canonical progress", () => {
    expect(buildReadingContext([
      { bookId: "mistborn-final-empire", chapter: 3.9 },
      { bookId: "mistborn-final-empire", chapter: 3.1 },
      { bookId: "mistborn-final-empire", chapter: 4.8 },
    ])).toEqual([
      { bookId: "mistborn-final-empire", chapter: 4, completed: false },
    ]);
  });

  it("treats non-finite progress conservatively without losing valid progress", () => {
    expect(buildReadingContext([
      { bookId: "mistborn-final-empire", chapter: 6 },
      { bookId: "mistborn-final-empire", chapter: Number.POSITIVE_INFINITY },
    ])).toEqual([
      { bookId: "mistborn-final-empire", chapter: 6, completed: false },
    ]);
  });
});
