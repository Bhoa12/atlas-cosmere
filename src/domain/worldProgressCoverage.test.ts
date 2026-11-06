import { describe, expect, it } from "vitest";
import { summarizeWorldProgress } from "./worldProgressCoverage";
import type { WorldCatalogEntry } from "./cosmereCatalog";

describe("summarizeWorldProgress", () => {
  it("aggregates only catalog-backed positions and keeps worlds independent", () => {
    const worlds = [
      { id: "scadrial", name: "Scadrial", works: [
        { id: "mistborn-1", title: "A", sequence: 1, units: [{ id: "u1", order: 1 }, { id: "u3", order: 3 }] },
      ] },
      { id: "sel", name: "Sel", works: [
        { id: "elantris", title: "B", sequence: 1, units: [{ id: "e2", order: 2 }] },
      ] },
    ] as WorldCatalogEntry[];

    expect(summarizeWorldProgress(worlds, [
      { workId: "mistborn-1", completedPositions: [1, 2] },
      { workId: "unknown", completedPositions: [1] },
    ])).toEqual([
      { worldId: "scadrial", declaredPositions: 2, completedPositions: 1, next: { workId: "mistborn-1", position: 3 }, ambiguousWorkIds: [] },
      { worldId: "sel", declaredPositions: 1, completedPositions: 0, next: { workId: "elantris", position: 2 }, ambiguousWorkIds: [] },
    ]);
  });

  it("fails closed for duplicate work ids instead of attributing their progress to either world", () => {
    const worlds = [
      { id: "scadrial", name: "Scadrial", works: [{ id: "shared", title: "A", sequence: 1, units: [{ id: "a1", order: 1 }] }] },
      { id: "other", name: "Other", works: [{ id: "shared", title: "B", sequence: 1, units: [{ id: "b1", order: 1 }] }] },
    ] as WorldCatalogEntry[];

    expect(summarizeWorldProgress(worlds, [{ workId: "shared", completedPositions: [1] }])).toEqual([
      { worldId: "scadrial", declaredPositions: 0, completedPositions: 0, next: null, ambiguousWorkIds: ["shared"] },
      { worldId: "other", declaredPositions: 0, completedPositions: 0, next: null, ambiguousWorkIds: ["shared"] },
    ]);
  });
});
