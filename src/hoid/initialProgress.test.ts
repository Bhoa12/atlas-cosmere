import { describe, expect, it } from "vitest";
import { createEmptyAtlasReadingProgress } from "./initialProgress";
import { toHoidReadingPositions } from "./progressAdapter";

describe("safe initial Atlas reading progress", () => {
  it("starts with no implicit chapters or completed works", () => {
    const initial = createEmptyAtlasReadingProgress();

    expect(Object.keys(initial.chaptersByBook)).toEqual([]);
    expect(Object.keys(initial.completedByBook)).toEqual([]);
    expect(Object.keys(initial.communityBoundariesByBook)).toEqual([]);
    expect(toHoidReadingPositions(initial)).toEqual([]);
  });

  it("uses null-prototype maps so special property names cannot alter inheritance", () => {
    const initial = createEmptyAtlasReadingProgress();

    expect(Object.getPrototypeOf(initial.chaptersByBook)).toBeNull();
    expect(Object.getPrototypeOf(initial.completedByBook)).toBeNull();
    expect(Object.getPrototypeOf(initial.communityBoundariesByBook)).toBeNull();
  });

  it("returns independent immutable maps for each new profile", () => {
    const first = createEmptyAtlasReadingProgress();
    const second = createEmptyAtlasReadingProgress();

    expect(first).not.toBe(second);
    expect(first.completedByBook).not.toBe(second.completedByBook);
    expect(first.chaptersByBook).not.toBe(second.chaptersByBook);
    expect(first.communityBoundariesByBook).not.toBe(second.communityBoundariesByBook);
    expect(Object.isFrozen(first.completedByBook)).toBe(true);
    expect(Object.isFrozen(first.chaptersByBook)).toBe(true);
    expect(Object.isFrozen(first.communityBoundariesByBook)).toBe(true);

    expect(Reflect.set(first.completedByBook, "tfe", true)).toBe(false);
    expect(Reflect.set(first.chaptersByBook, "twok", 1)).toBe(false);
    expect(Object.keys(second.completedByBook)).toEqual([]);
    expect(Object.keys(second.chaptersByBook)).toEqual([]);
    expect(Object.keys(second.communityBoundariesByBook)).toEqual([]);
  });

  it("does not seed the former sample completions", () => {
    const initial = createEmptyAtlasReadingProgress();

    expect(Object.prototype.hasOwnProperty.call(initial.completedByBook, "tfe")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(initial.completedByBook, "twok")).toBe(false);
  });
});
