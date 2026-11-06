import { buildReadingContext, HoidReadingContextItem } from "./readingContext";

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

  it("does not expose caller-owned mutable state", () => {
    const reading = [{ bookId: "mistborn-final-empire", chapter: 2, completed: false }];
    const context = buildReadingContext(reading);
    reading[0].chapter = 99;

    expect(context).toEqual([
      { bookId: "mistborn-final-empire", chapter: 2, completed: false },
    ]);
  });

  it("returns fresh metadata-only items that callers may safely consume", () => {
    const context: HoidReadingContextItem[] = buildReadingContext([
      { bookId: "mistborn-final-empire", chapter: 4, completed: false },
    ]);
    context[0].chapter = 0;

    expect(buildReadingContext([
      { bookId: "mistborn-final-empire", chapter: 4, completed: false },
    ])[0].chapter).toBe(4);
  });
});
