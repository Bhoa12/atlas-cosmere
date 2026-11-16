import { describe, expect, it } from "vitest";
import { validEditionBoundReadingPositions } from "./editionProgressValidation";

describe("edition-bound reading authorization", () => {
  it("accepts known, in-range numeric chapter positions", () => {
    expect(validEditionBoundReadingPositions([
      { bookId: "tfe", chapter: 38 },
      { bookId: "twok", chapter: 75 },
    ])).toEqual([
      { bookId: "tfe", chapter: 38 },
      { bookId: "twok", chapter: 75 },
    ]);
  });

  it("rejects chapter values beyond the inspected edition count", () => {
    expect(validEditionBoundReadingPositions([
      { bookId: "tfe", chapter: 39 },
    ])).toBeNull();
  });

  it("rejects progress at or beyond the first duplicated chapter locator", () => {
    expect(validEditionBoundReadingPositions([
      { bookId: "elantris", chapter: 47 },
    ])).toEqual([{ bookId: "elantris", chapter: 47 }]);
    expect(validEditionBoundReadingPositions([
      { bookId: "elantris", chapter: 48 },
    ])).toBeNull();
    expect(validEditionBoundReadingPositions([
      { bookId: "sawt", chapter: 12 },
    ])).toBeNull();
  });

  it("rejects numeric cursors for merged volumes and collections", () => {
    expect(validEditionBoundReadingPositions([
      { bookId: "white-sand-2", chapter: 3 },
    ])).toBeNull();
    expect(validEditionBoundReadingPositions([
      { bookId: "arcanum", chapter: 3 },
    ])).toBeNull();
  });

  it("preserves explicit completion for known collection and volume IDs", () => {
    expect(validEditionBoundReadingPositions([
      { bookId: "arcanum", completed: true },
      { bookId: "white-sand-2", completed: true },
    ])).toEqual([
      { bookId: "arcanum", completed: true },
      { bookId: "white-sand-2", completed: true },
    ]);
  });

  it("ignores unknown works without letting them authorize known works", () => {
    expect(validEditionBoundReadingPositions([
      { bookId: "unlisted", chapter: 999 },
      { bookId: "tfe", chapter: 4 },
    ])).toEqual([{ bookId: "tfe", chapter: 4 }]);
  });

  it("rejects zero and non-integer chapter positions for known works", () => {
    expect(validEditionBoundReadingPositions([{ bookId: "tfe", chapter: 0 }])).toBeNull();
    expect(validEditionBoundReadingPositions([{ bookId: "tfe", chapter: 1.5 }])).toEqual([]);
  });

  it("rejects duplicate positions for one work", () => {
    expect(validEditionBoundReadingPositions([
      { bookId: "tfe", chapter: 2 },
      { bookId: "tfe", chapter: 8 },
    ])).toBeNull();
  });
});
