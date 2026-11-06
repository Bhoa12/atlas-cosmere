import { buildReadingContext } from "./readingContext";

describe("buildReadingContext", () => {
  it("keeps only known sources and canonicalizes chapter progress", () => {
    expect(buildReadingContext([
      { bookId: "unknown", chapter: 99, completed: true },
      { bookId: "tfe", chapter: 3 },
      { bookId: "tfe", chapter: 7 },
    ])).toEqual([
      { bookId: "tfe", chapter: 7, completed: false },
    ]);
  });

  it("fails closed for invalid chapters and keeps completion monotonic", () => {
    expect(buildReadingContext([
      { bookId: "tfe", chapter: Number.NaN },
      { bookId: "tfe", chapter: -5, completed: true },
    ])).toEqual([
      { bookId: "tfe", chapter: 0, completed: true },
    ]);
  });
});

describe("reading context immutability", () => {
  it("returns immutable snapshots so callers cannot alter canonical state", () => {
    const context = buildReadingContext([
      { bookId: "tfe", chapter: 4 },
    ]);
    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context[0])).toBe(true);
  });
});
