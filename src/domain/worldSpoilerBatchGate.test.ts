import { describe, expect, it } from "vitest";
import { resolveWorldSpoilerBatchGate } from "./worldSpoilerBatchGate";

describe("resolveWorldSpoilerBatchGate", () => {
  it("reveals only requests at or behind an in-progress frontier", () => {
    expect(resolveWorldSpoilerBatchGate({
      worldId: "scadrial",
      frontierStatus: "in-progress",
      safeCompletedPositions: 2,
      declaredPositions: 4,
      requests: [
        { contentId: "a", contentWorldId: "scadrial", requiredPosition: 1 },
        { contentId: "b", contentWorldId: "scadrial", requiredPosition: 2 },
        { contentId: "c", contentWorldId: "scadrial", requiredPosition: 3 },
      ],
    })).toEqual({ status: "resolved", allowedContentIds: ["a", "b"] });
  });

  it("blocks an ambiguous batch instead of partially resolving it", () => {
    expect(resolveWorldSpoilerBatchGate({
      worldId: "sel",
      frontierStatus: "in-progress",
      safeCompletedPositions: 1,
      declaredPositions: 2,
      requests: [
        { contentId: "same", contentWorldId: "sel", requiredPosition: 1 },
        { contentId: "same", contentWorldId: "sel", requiredPosition: 2 },
      ],
    })).toEqual({ status: "blocked", allowedContentIds: [] });
  });

  it("never reveals content before a world has started", () => {
    expect(resolveWorldSpoilerBatchGate({
      worldId: "nalthis",
      frontierStatus: "not-started",
      safeCompletedPositions: 0,
      declaredPositions: 1,
      requests: [{ contentId: "x", contentWorldId: "nalthis", requiredPosition: 1 }],
    })).toEqual({ status: "resolved", allowedContentIds: [] });
  });
});


  it("reveals every valid request when a declared world is complete", () => {
    expect(resolveWorldSpoilerBatchGate({
      worldId: "taldain",
      frontierStatus: "complete",
      safeCompletedPositions: 3,
      declaredPositions: 3,
      requests: [
        { contentId: "one", contentWorldId: "taldain", requiredPosition: 1 },
        { contentId: "three", contentWorldId: "taldain", requiredPosition: 3 },
      ],
    })).toEqual({ status: "resolved", allowedContentIds: ["one", "three"] });
  });

  it("blocks inconsistent complete frontiers", () => {
    expect(resolveWorldSpoilerBatchGate({
      worldId: "sel",
      frontierStatus: "complete",
      safeCompletedPositions: 1,
      declaredPositions: 2,
      requests: [{ contentId: "x", contentWorldId: "sel", requiredPosition: 1 }],
    })).toEqual({ status: "blocked", allowedContentIds: [] });
  });
