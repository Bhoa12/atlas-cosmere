import { describe, expect, it } from "vitest";
import { evaluateSpoilerGate, reconcileProgress, validateExpansion } from "./cosmereExpansionRun88";

describe("cosmere expansion run 88", () => {
  const sources = [
    { id: "catalog", kind: "verified-index" as const, accessible: true },
    { id: "editorial", kind: "editorial-accessible" as const, accessible: true },
  ];

  it("rejects reading structure backed only by a catalog index", () => {
    const result = validateExpansion(sources, [], [{ id: "work", title: "Catalog title", sourceId: "catalog" }], [], [
      { id: "u1", workId: "work", position: 1, sourceId: "catalog" },
    ], []);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("untrusted-structure:unit:u1");
  });

  it("keeps progress scoped and ordered by explicit units", () => {
    const completed = reconcileProgress(
      { workId: "work", completedUnitIds: ["u2", "foreign", "u1", "u1"] },
      [
        { id: "u2", workId: "work", position: 2, sourceId: "editorial" },
        { id: "u1", workId: "work", position: 1, sourceId: "editorial" },
        { id: "foreign", workId: "other", position: 1, sourceId: "editorial" },
      ],
    );
    expect(completed).toEqual(["u1", "u2"]);
  });

  it("fails closed when a gate references an invalid requirement", () => {
    const gate = { id: "g", workId: "work", requiredUnitIds: ["missing"] };
    expect(evaluateSpoilerGate(gate, ["missing"], []).visible).toBe(false);
  });
});