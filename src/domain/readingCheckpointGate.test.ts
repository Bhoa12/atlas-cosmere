import { describe, expect, it } from "vitest";
import { resolveReadingCheckpointGate } from "./readingCheckpointGate";

describe("resolveReadingCheckpointGate", () => {
  it("allows only checkpoints whose explicit unit is completed", () => {
    const result = resolveReadingCheckpointGate(
      [
        { id: "u1", workId: "work", position: 1 },
        { id: "u2", workId: "work", position: 2 },
      ],
      [{ workId: "work", completedUnitIds: ["u1"] }],
      [
        { contentId: "safe", workId: "work", requiredUnitId: "u1" },
        { contentId: "locked", workId: "work", requiredUnitId: "u2" },
      ],
    );
    expect(result).toEqual({
      status: "valid",
      decisions: [
        { contentId: "safe", allowed: true },
        { contentId: "locked", allowed: false },
      ],
    });
  });

  it("blocks a checkpoint that crosses works", () => {
    const result = resolveReadingCheckpointGate(
      [{ id: "u1", workId: "one", position: 1 }],
      [],
      [{ contentId: "content", workId: "two", requiredUnitId: "u1" }],
    );
    expect(result).toEqual({ status: "blocked", decisions: [] });
  });

  it("blocks ambiguous duplicate content identifiers", () => {
    const result = resolveReadingCheckpointGate(
      [{ id: "u1", workId: "work", position: 1 }],
      [],
      [
        { contentId: "same", workId: "work", requiredUnitId: "u1" },
        { contentId: "same", workId: "work", requiredUnitId: "u1" },
      ],
    );
    expect(result).toEqual({ status: "blocked", decisions: [] });
  });

  it("blocks invalid cross-work progress before evaluating checkpoints", () => {
    const result = resolveReadingCheckpointGate(
      [{ id: "u1", workId: "one", position: 1 }],
      [{ workId: "two", completedUnitIds: ["u1"] }],
      [],
    );
    expect(result).toEqual({ status: "blocked", decisions: [] });
  });
});
