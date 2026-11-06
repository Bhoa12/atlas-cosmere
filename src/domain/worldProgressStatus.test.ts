import { describe, expect, it } from "vitest";
import { resolveWorldProgressStatus } from "./worldProgressStatus";

describe("resolveWorldProgressStatus", () => {
  const base = {
    worldId: "scadrial",
    declaredPositions: 3,
    completedPositions: 0,
    next: { workId: "mistborn-1", position: 1 },
    ambiguousWorkIds: [],
  };

  it("reports not-started, in-progress and complete from structural coverage", () => {
    expect(resolveWorldProgressStatus(base)).toBe("not-started");
    expect(resolveWorldProgressStatus({ ...base, completedPositions: 1 })).toBe("in-progress");
    expect(resolveWorldProgressStatus({
      ...base,
      completedPositions: 3,
      next: null,
    })).toBe("complete");
  });

  it("fails closed for ambiguous or structurally empty coverage", () => {
    expect(resolveWorldProgressStatus({
      ...base,
      ambiguousWorkIds: ["shared-work"],
    })).toBe("blocked");
    expect(resolveWorldProgressStatus({
      ...base,
      declaredPositions: 0,
      next: null,
    })).toBe("blocked");
  });
});
