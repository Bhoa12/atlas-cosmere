import { describe, expect, it } from "vitest";
import { toHoidReadingPositions } from "./progressAdapter";

describe("edition-aware Atlas progress adapter", () => {
  it("accepts a chapter within a verified numeric edition range", () => {
    expect(toHoidReadingPositions({ chaptersByBook: { tfe: 38 } })).toEqual([
      { bookId: "tfe", chapter: 38 },
    ]);
  });

  it("rejects a chapter beyond the verified edition range", () => {
    expect(toHoidReadingPositions({ chaptersByBook: { tfe: 39 } })).toEqual([]);
  });

  it("caps Elantris numeric progress before the first duplicated chapter locator", () => {
    expect(toHoidReadingPositions({ chaptersByBook: { elantris: 47 } })).toEqual([
      { bookId: "elantris", chapter: 47 },
    ]);
    expect(toHoidReadingPositions({ chaptersByBook: { elantris: 48 } })).toEqual([]);
    expect(toHoidReadingPositions({ chaptersByBook: { elantris: 63 } })).toEqual([]);
  });

  it("caps Viento y verdad numeric progress before duplicated chapter locators", () => {
    expect(toHoidReadingPositions({ chaptersByBook: { sawt: 11 } })).toEqual([
      { bookId: "sawt", chapter: 11 },
    ]);
    expect(toHoidReadingPositions({ chaptersByBook: { sawt: 12 } })).toEqual([]);
  });

  it("does not treat merged White Sand volumes as one verified chapter sequence", () => {
    expect(toHoidReadingPositions({
      chaptersByBook: { "white-sand-1": 5, "white-sand-2": 7, "white-sand-3": 9 },
    })).toEqual([]);
  });

  it("does not treat Arcanum as one global numeric chapter sequence", () => {
    expect(toHoidReadingPositions({ chaptersByBook: { arcanum: 12 } })).toEqual([]);
  });

  it("preserves explicit completion for known works with non-numeric structure", () => {
    expect(toHoidReadingPositions({
      completedByBook: { "white-sand-1": true, arcanum: true },
    })).toEqual([
      { bookId: "arcanum", completed: true },
      { bookId: "white-sand-1", completed: true },
    ]);
  });

  it("ignores unknown works and malformed numeric progress", () => {
    expect(toHoidReadingPositions({
      chaptersByBook: { "not-in-catalog": 50, tfe: 1.5, woa: -1 },
    })).toEqual([]);
  });

  it("does not accept inherited completion flags as user progress", () => {
    const inheritedCompletion = Object.create({ tfe: true }) as Record<string, boolean>;
    expect(toHoidReadingPositions({
      chaptersByBook: { tfe: 0 },
      completedByBook: inheritedCompletion,
    })).toEqual([]);
  });

  it("returns an empty snapshot for malformed top-level input", () => {
    expect(toHoidReadingPositions(null as never)).toEqual([]);
    expect(toHoidReadingPositions([] as never)).toEqual([]);
  });

  it("does not mutate the caller-owned progress records", () => {
    const progress = { chaptersByBook: { tfe: 4 }, completedByBook: { woa: true } };
    const before = JSON.stringify(progress);
    toHoidReadingPositions(progress);
    expect(JSON.stringify(progress)).toBe(before);
  });
});
