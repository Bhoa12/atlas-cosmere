import { describe, expect, it } from "vitest";
import { resolveWorldSpoilerBatchGate } from "./worldSpoilerBatchGate";

describe("resolveWorldSpoilerBatchGate input hardening", () => {
  it("blocks an unsafe integer position instead of authorizing content", () => {
    const result = resolveWorldSpoilerBatchGate({
      worldId: "scadrial",
      frontierStatus: "in-progress",
      safeCompletedPositions: Number.MAX_SAFE_INTEGER + 1,
      requests: [
        {
          contentId: "scadrial-safe",
          contentWorldId: "scadrial",
          requiredPosition: 1,
        },
      ],
    });

    expect(result).toEqual({ status: "blocked", allowedContentIds: [] });
  });

  it("blocks malformed runtime identifiers fail-closed", () => {
    const result = resolveWorldSpoilerBatchGate({
      worldId: "sel",
      frontierStatus: "in-progress",
      safeCompletedPositions: 1,
      requests: [
        {
          contentId: 7 as unknown as string,
          contentWorldId: "sel",
          requiredPosition: 1,
        },
      ],
    });

    expect(result).toEqual({ status: "blocked", allowedContentIds: [] });
  });
});
