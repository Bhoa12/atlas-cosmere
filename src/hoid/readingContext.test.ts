import { buildReadingContext } from "./readingContext";

describe("buildReadingContext", () => {
  it("keeps only known sources and canonicalizes chapter progress", () => {
    expect(buildReadingContext([
      { bookId: "unknown", chapter: 99, completed: true },
      { bookId: "mistborn-final-empire", chapter: 3 },
      { bookId: "mistborn-final-empire", chapter: 7 },
    ])).toEqual([
      { bookId: "mistborn-final-empire", chapter: 7, completed: false },
    ]);
  });

  it("fails closed for invalid chapters and keeps completion monotonic", () => {
    expect(buildReadingContext([
      { bookId: "mistborn-final-empire", chapter: Number.NaN },
      { bookId: "mistborn-final-empire", chapter: -5, completed: true },
    ])).toEqual([
      { bookId: "mistborn-final-empire", chapter: 0, completed: true },
    ]);
  });
});


describe("reading context immutability", () => {
  it("returns immutable snapshots so callers cannot alter canonical state", () => {
    const context = buildReadingContext([
      { bookId: "mistborn-final-empire", chapter: 4 },
    ]);
    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context[0])).toBe(true);
  });
});
