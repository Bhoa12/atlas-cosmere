import { describe, expect, it } from "vitest";
import { resolveWorldScopedSpoilerAccess } from "./worldScopedSpoilerAccess";

describe("resolveWorldScopedSpoilerAccess", () => {
  const base = {
    worldId: "scadrial",
    contentWorldId: "scadrial",
    requiredPosition: 2,
    frontierStatus: "in-progress" as const,
    safeCompletedPositions: 2,
  };

  it("allows only positions at or behind the validated frontier", () => {
    expect(resolveWorldScopedSpoilerAccess(base)).toEqual({
      status: "allowed",
      canReveal: true,
    });
    expect(resolveWorldScopedSpoilerAccess({
      ...base,
      requiredPosition: 3,
    })).toEqual({ status: "locked", canReveal: false });
  });

  it("fails closed for blocked frontiers and cross-world requests", () => {
    expect(resolveWorldScopedSpoilerAccess({
      ...base,
      frontierStatus: "blocked",
    })).toEqual({ status: "blocked", canReveal: false });
    expect(resolveWorldScopedSpoilerAccess({
      ...base,
      contentWorldId: "sel",
    })).toEqual({ status: "blocked", canReveal: false });
    expect(resolveWorldScopedSpoilerAccess({
      ...base,
      requiredPosition: 0,
    })).toEqual({ status: "blocked", canReveal: false });
  });
});
