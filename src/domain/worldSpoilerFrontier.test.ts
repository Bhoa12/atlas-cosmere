import { describe, expect, it } from "vitest";
import { resolveWorldSpoilerFrontier } from "./worldSpoilerFrontier";

describe("resolveWorldSpoilerFrontier", () => {
  const base = {
    declaredPositions: 4,
    completedPositions: 0,
    ambiguousWorkIds: [],
  };

  it("tracks only the validated contiguous frontier", () => {
    expect(resolveWorldSpoilerFrontier(base)).toEqual({
      status: "not-started",
      safeCompletedPositions: 0,
    });
    expect(resolveWorldSpoilerFrontier({ ...base, completedPositions: 2 })).toEqual({
      status: "in-progress",
      safeCompletedPositions: 2,
    });
    expect(resolveWorldSpoilerFrontier({ ...base, completedPositions: 4 })).toEqual({
      status: "complete",
      safeCompletedPositions: 4,
    });
  });

  it("fails closed when sequence coverage is ambiguous or malformed", () => {
    expect(resolveWorldSpoilerFrontier({ ...base, ambiguousWorkIds: ["unknown"] })).toEqual({
      status: "blocked",
      safeCompletedPositions: 0,
    });
    expect(resolveWorldSpoilerFrontier({ ...base, declaredPositions: 0 })).toEqual({
      status: "blocked",
      safeCompletedPositions: 0,
    });
    expect(resolveWorldSpoilerFrontier({ ...base, completedPositions: 5 })).toEqual({
      status: "blocked",
      safeCompletedPositions: 0,
    });
  });
});
