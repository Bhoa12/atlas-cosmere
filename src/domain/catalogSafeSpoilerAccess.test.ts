import { describe, expect, it } from "vitest";
import { resolveCatalogSafeUnlockedGateIds } from "./catalogSafeSpoilerAccess";
import type { WorldCatalogEntry } from "./cosmereCatalog";

const worlds: WorldCatalogEntry[] = [{
  id: "scadrial",
  name: "Scadrial",
  works: [{
    id: "work-a",
    title: "Declared work",
    sequence: 1,
    units: [{ id: "u1", order: 1 }],
  }],
}];

describe("resolveCatalogSafeUnlockedGateIds", () => {
  it("unlocks a gate only when its declared checkpoint is completed", () => {
    expect(resolveCatalogSafeUnlockedGateIds(
      worlds,
      [{ id: "safe", requirements: [{ workId: "work-a", requiredPosition: 1 }] }],
      [{ workId: "work-a", completedPositions: [1, 1] }],
    )).toEqual(["safe"]);
  });

  it("keeps gates with undeclared or unknown dependencies locked", () => {
    expect(resolveCatalogSafeUnlockedGateIds(
      worlds,
      [
        { id: "missing-position", requirements: [{ workId: "work-a", requiredPosition: 2 }] },
        { id: "missing-work", requirements: [{ workId: "unknown", requiredPosition: 1 }] },
      ],
      [
        { workId: "work-a", completedPositions: [2] },
        { workId: "unknown", completedPositions: [1] },
      ],
    )).toEqual([]);
  });
});
