import {
  canReveal,
  resolveWorld,
  validateCatalogue,
  type ExpansionCatalogue,
} from "./sourceSafeExpansion";
import { cosmereExpansionSeed } from "./cosmereExpansionSeed";

const base: ExpansionCatalogue = {
  sources: [{ id: "source-a", label: "Source A", status: "verified-index" }],
  worlds: [{ id: "world-a", label: "World A" }],
  works: [{ id: "work-a", title: "Work A", sourceId: "source-a" }],
  units: [
    { id: "unit-1", workId: "work-a", order: 1, label: "Part 1" },
    { id: "unit-2", workId: "work-a", order: 2, label: "Part 2" },
  ],
  assignments: [],
};

describe("source-safe Cosmere expansion", () => {
  it("accepts the verified bibliographic seed without inferred assignments", () => {
    expect(validateCatalogue(cosmereExpansionSeed)).toEqual([]);
    expect(cosmereExpansionSeed.assignments).toEqual([]);
    expect(cosmereExpansionSeed.units).toEqual([]);
  });

  it("fails closed until every explicit reading requirement is complete", () => {
    const requirement = {
      id: "gate-a",
      workId: "work-a",
      requiredUnitIds: ["unit-1", "unit-2"],
    };
    expect(canReveal(requirement, { workId: "work-a", completedUnitIds: ["unit-1"] }, base.units)).toBe(false);
    expect(canReveal(requirement, { workId: "work-a", completedUnitIds: ["unit-1", "unit-2"] }, base.units)).toBe(true);
  });

  it("does not guess a world when assignments are missing or ambiguous", () => {
    expect(resolveWorld("work-a", [])).toBeUndefined();
    expect(resolveWorld("work-a", [
      { id: "assignment-1", sourceId: "source-a", evidenceKind: "explicit-metadata", workId: "work-a", worldId: "world-a" },
      { id: "assignment-2", sourceId: "source-a", evidenceKind: "explicit-metadata", workId: "work-a", worldId: "world-a" },
    ])).toBeUndefined();
  });
});
