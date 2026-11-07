import { describe, expect, it } from "vitest";
import { resolveWorldScopedSpoilerAccess } from "./worldScopedSpoilerAccess";

describe("resolveWorldScopedSpoilerAccess", () => {
  const base = {
    worldId: "scadrial",
    contentWorldId: "scadrial",
    requiredPosition: 2,
    frontierStatus: "in-progress" as const,
    safeCompletedPositions: 2,
    declaredPositions: 3,
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
      safeCompletedPositions: 0,
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

  it("does not allow a not-started frontier to reveal position zero by accident", () => {
    expect(resolveWorldScopedSpoilerAccess({
      ...base,
      frontierStatus: "not-started",
      safeCompletedPositions: 0,
      requiredPosition: 1,
    })).toEqual({ status: "locked", canReveal: false });
  });

  it("rejects inconsistent complete frontiers and positions outside declared range", () => {
    expect(resolveWorldScopedSpoilerAccess({
      ...base,
      frontierStatus: "complete",
      safeCompletedPositions: 2,
    })).toEqual({ status: "blocked", canReveal: false });
    expect(resolveWorldScopedSpoilerAccess({
      ...base,
      frontierStatus: "complete",
      safeCompletedPositions: 3,
      requiredPosition: 4,
    })).toEqual({ status: "blocked", canReveal: false });
  });

  it("rejects inconsistent in-progress frontiers", () => {\n    expect(resolveWorldScopedSpoilerAccess({\n      ...base,\n      frontierStatus: "in-progress",\n      safeCompletedPositions: 0,\n    })).toEqual({ status: "blocked", canReveal: false });\n    expect(resolveWorldScopedSpoilerAccess({\n      ...base,\n      frontierStatus: "in-progress",\n      safeCompletedPositions: 3,\n    })).toEqual({ status: "blocked", canReveal: false });\n  });\n});\n