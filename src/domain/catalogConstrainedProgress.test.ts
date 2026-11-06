import { describe, expect, it } from "vitest";
import type { WorldCatalogEntry } from "./cosmereCatalog";
import { constrainProgressToCatalog } from "./catalogConstrainedProgress";

const worlds: WorldCatalogEntry[] = [{
  id: "scadrial",
  name: "Scadrial",
  works: [{
    id: "work-a",
    title: "Declared work",
    sequence: 1,
    units: [{ id: "u1", order: 1 }, { id: "u2", order: 2 }],
  }],
}];

describe("constrainProgressToCatalog", () => {
  it("keeps only declared positions and merges duplicate states", () => {
    expect(constrainProgressToCatalog(worlds, [
      { workId: "work-a", completedPositions: [2, 2, 3, 0] },
      { workId: "work-a", completedPositions: [1] },
    ])).toEqual([{ workId: "work-a", completedPositions: [1, 2] }]);
  });

  it("drops unknown works and states with no declared completed positions", () => {
    expect(constrainProgressToCatalog(worlds, [
      { workId: "unknown", completedPositions: [1] },
      { workId: "work-a", completedPositions: [9] },
    ])).toEqual([]);
  });

  it("fails closed when a work id is ambiguous across catalog entries", () => {
    const ambiguous: WorldCatalogEntry[] = [
      { id: "scadrial", name: "Scadrial", works: [{ id: "shared", title: "A", sequence: 1, units: [{ id: "a1", order: 1 }] }] },
      { id: "sel", name: "Sel", works: [{ id: "shared", title: "B", sequence: 1, units: [{ id: "b2", order: 2 }] }] },
    ];

    expect(constrainProgressToCatalog(ambiguous, [
      { workId: "shared", completedPositions: [1, 2] },
    ])).toEqual([]);
  });
});
