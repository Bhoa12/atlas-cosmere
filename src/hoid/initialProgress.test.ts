import { describe, expect, it } from "vitest";
import { createEmptyAtlasReadingProgress } from "./initialProgress";
import { toHoidReadingPositions } from "./progressAdapter";

describe("safe initial Atlas reading progress", () => {
  it("starts with no implicit chapters or completed works", () => {
    const initial = createEmptyAtlasReadingProgress();

    expect(Object.keys(initial.chaptersByBook)).toEqual([]);
    expect(Object.keys(initial.completedByBook)).toEqual([]);
    expect(toHoidReadingPositions(initial)).toEqual([]);
  });

  it("uses null-prototype maps so special property names cannot alter inheritance", () => {
    const initial = createEmptyAtlasReadingProgress();

    expect(Object.getPrototypeOf(initial.chaptersByBook)).toBeNull();
    expect(Object.getPrototypeOf(initial.completedByBook)).toBeNull();
  });

  it("returns independent maps for each new profile", () => {
    const first = createEmptyAtlasReadingProgress();
    const second = createEmptyAtlasReadingProgress();

    first.completedByBook.tfe = true;
    first.chaptersByBook.twok = 1;

    expect(Object.keys(second.completedByBook)).toEqual([]);
    expect(Object.keys(second.chaptersByBook)).toEqual([]);
  });

  it("does not seed the former sample completions", () => {
    const initial = createEmptyAtlasReadingProgress();

    expect(Object.prototype.hasOwnProperty.call(initial.completedByBook, "tfe")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(initial.completedByBook, "twok")).toBe(false);
  });
});
