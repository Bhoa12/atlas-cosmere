import { describe, expect, it } from "vitest";
import { resolveSpoilerCheckpointGate } from "./spoilerCheckpointGate";

describe("resolveSpoilerCheckpointGate", () => {
  const units = [
    { id: "u1", workId: "work", position: 1 },
    { id: "u2", workId: "work", position: 2 },
    { id: "other", workId: "other-work", position: 1 },
  ];

  it("allows content only when every explicit requirement is completed", () => {
    const result = resolveSpoilerCheckpointGate(
      units,
      [{ workId: "work", completedUnitIds: ["u1"] }],
      [
        { contentId: "single", workId: "work", requiredUnitIds: ["u1"] },
        { contentId: "multi", workId: "work", requiredUnitIds: ["u1", "u2"] },
      ],
    );
    expect(result).toEqual({
      status: "valid",
      decisions: [
        { contentId: "single", allowed: true },
        { contentId: "multi", allowed: false },
      ],
    });
  });

  it("blocks empty or duplicate checkpoint requirements", () => {
    expect(resolveSpoilerCheckpointGate(units, [], [{ contentId: "x", workId: "work", requiredUnitIds: [] }]))
      .toEqual({ status: "blocked", decisions: [] });
    expect(resolveSpoilerCheckpointGate(units, [], [{ contentId: "x", workId: "work", requiredUnitIds: ["u1", "u1"] }]))
      .toEqual({ status: "blocked", decisions: [] });
  });

  it("blocks requirements that cross works", () => {
    const result = resolveSpoilerCheckpointGate(
      units,
      [],
      [{ contentId: "x", workId: "work", requiredUnitIds: ["other"] }],
    );
    expect(result).toEqual({ status: "blocked", decisions: [] });
  });
});
