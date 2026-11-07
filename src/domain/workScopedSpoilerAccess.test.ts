import { describe, expect, it } from "vitest";
import { canRevealWorkScopedPosition } from "./workScopedSpoilerAccess";

describe("canRevealWorkScopedPosition", () => {
  const base = {
    worldId: "scadrial",
    contentWorldId: "scadrial",
    workId: "mistborn-era-1",
    contentWorkId: "mistborn-era-1",
    requiredPosition: 2,
    safeCompletedPositions: 2,
    declaredPositions: 3,
  };

  it("allows a completed position inside the same validated work", () => {
    expect(canRevealWorkScopedPosition(base)).toBe(true);
  });

  it("locks future positions and positions outside the declared work range", () => {
    expect(canRevealWorkScopedPosition({
      ...base,
      requiredPosition: 3,
    })).toBe(false);
    expect(canRevealWorkScopedPosition({
      ...base,
      requiredPosition: 4,
    })).toBe(false);
  });

  it("fails closed when world or work scope does not match", () => {
    expect(canRevealWorkScopedPosition({
      ...base,
      contentWorldId: "sel",
    })).toBe(false);
    expect(canRevealWorkScopedPosition({
      ...base,
      contentWorkId: "another-work",
    })).toBe(false);
  });

  it("rejects malformed ranges and identifiers", () => {
    expect(canRevealWorkScopedPosition({
      ...base,
      workId: " ",
    })).toBe(false);
    expect(canRevealWorkScopedPosition({
      ...base,
      safeCompletedPositions: 4,
    })).toBe(false);
    expect(canRevealWorkScopedPosition({
      ...base,
      requiredPosition: 0,
    })).toBe(false);
  });
});
