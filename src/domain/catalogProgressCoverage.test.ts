import { describe, expect, it } from "vitest";
import { summarizeCatalogProgress } from "./catalogProgressCoverage";
import type { WorldCatalogEntry } from "./cosmereCatalog";

const worlds: WorldCatalogEntry[] = [{
  id: "scadrial",
  name: "Scadrial",
  works: [
    { id: "a", title: "A", sequence: 1, units: [{ id: "a1", order: 1 }, { id: "a3", order: 3 }] },
    { id: "b", title: "B", sequence: 2, units: [{ id: "b2", order: 2 }] },
  ],
}];

describe("summarizeCatalogProgress", () => {
  it("counts only declared completed positions and selects the next declared coordinate", () => {
    expect(summarizeCatalogProgress(worlds, [
      { workId: "a", completedPositions: [1, 2, 3] },
      { workId: "unknown", completedPositions: [1] },
    ])).toEqual([
      { workId: "a", declaredPositions: 2, completedPositions: 2, nextPosition: null },
      { workId: "b", declaredPositions: 1, completedPositions: 0, nextPosition: 2 },
    ]);
  });

  it("does not invent a next position when a work has no declared units", () => {
    const empty: WorldCatalogEntry[] = [{
      id: "sel",
      name: "Sel",
      works: [{ id: "c", title: "C", sequence: 1, units: [] }],
    }];
    expect(summarizeCatalogProgress(empty, [])).toEqual([
      { workId: "c", declaredPositions: 0, completedPositions: 0, nextPosition: null },
    ]);
  });
});
