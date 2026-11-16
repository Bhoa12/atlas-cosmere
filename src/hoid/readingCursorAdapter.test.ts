import { describe, expect, it } from "vitest";
import { toHoidReadingCursorPositions } from "./readingCursorAdapter";

describe("Atlas reading cursor adapter", () => {
  it("projects a verified numeric chapter into an edition-bound cursor", () => {
    expect(toHoidReadingCursorPositions({
      chaptersByBook: { tfe: 12 },
    })).toMatchObject([
      {
        bookId: "tfe",
        cursor: {
          unitId: "chapter:012",
          ordinal: 12,
          chapterNumber: 12,
        },
      },
    ]);
  });

  it("preserves explicit completion as a distinct reader-declared state", () => {
    expect(toHoidReadingCursorPositions({
      completedByBook: { tfe: true },
    })).toEqual([{ bookId: "tfe", completed: true }]);
  });

  it("does not create cursors for unsegmented volumes or collections", () => {
    expect(toHoidReadingCursorPositions({
      chaptersByBook: {
        "white-sand-1": 5,
        "white-sand-2": 7,
        "white-sand-3": 9,
        arcanum: 12,
      },
    })).toEqual([]);
  });

  it("omits ambiguous numeric progress while retaining the safe prefix", () => {
    expect(toHoidReadingCursorPositions({
      chaptersByBook: { elantris: 47, sawt: 12 },
    })).toMatchObject([
      {
        bookId: "elantris",
        cursor: {
          unitId: "chapter:047",
          chapterNumber: 47,
        },
      },
    ]);
  });

  it("does not mutate Atlas-owned progress maps", () => {
    const progress = {
      chaptersByBook: { tfe: 8 },
      completedByBook: { woa: true },
    };
    const before = JSON.stringify(progress);
    toHoidReadingCursorPositions(progress);
    expect(JSON.stringify(progress)).toBe(before);
  });
});
