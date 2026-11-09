import { describe, expect, it } from "vitest";
import { resolveReadingProgressSummaries } from "./readingProgressSummary";

describe("resolveReadingProgressSummaries", () => {
  it("summarizes explicit units without editorial inference", () => {
    const result = resolveReadingProgressSummaries(
      [
        { id: "a", workId: "work", position: 1 },
        { id: "b", workId: "work", position: 2 },
      ],
      [{ workId: "work", completedUnitIds: ["a"] }],
    );
    expect(result).toEqual({
      status: "valid",
      summaries: [{ workId: "work", totalUnits: 2, completedUnits: 1, fraction: 0.5, nextUnitId: "b" }],
    });
  });

  it("blocks cross-work completion", () => {
    const result = resolveReadingProgressSummaries(
      [{ id: "a", workId: "one", position: 1 }],
      [{ workId: "two", completedUnitIds: ["a"] }],
    );
    expect(result).toEqual({ status: "blocked", summaries: [] });
  });

  it("blocks ambiguous duplicate positions", () => {
    const result = resolveReadingProgressSummaries(
      [
        { id: "a", workId: "work", position: 1 },
        { id: "b", workId: "work", position: 1 },
      ],
      [],
    );
    expect(result).toEqual({ status: "blocked", summaries: [] });
  });
});
