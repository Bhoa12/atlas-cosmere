import { buildReadingContext } from "./readingContext";

describe("buildReadingContext", () => {
  it("keeps only known sources and preserves validated progress", () => {
    expect(buildReadingContext([
      { bookId: "unknown", chapter: 99, completed: true },
      { bookId: "tfe", chapter: 3 },
    ])).toEqual([
      { bookId: "tfe", chapter: 3, completed: false },
    ]);
  });

  it("fails closed when duplicate positions could inflate progress", () => {
    expect(buildReadingContext([
      { bookId: "tfe", chapter: 3 },
      { bookId: "tfe", chapter: 7 },
    ])).toEqual([]);
  });

  it("discards malformed progress before building context", () => {
    expect(buildReadingContext([
      { bookId: "tfe", chapter: Number.NaN },
      { bookId: "tfe", chapter: 2 },
    ])).toEqual([
      { bookId: "tfe", chapter: 2, completed: false },
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
