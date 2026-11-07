import { describe, expect, it } from "vitest";
import { canRevealSpoilerSafeContent } from "./spoilerSafeContentGate";
import { privateCosmereSourceCatalog } from "./privateCosmereSourceCatalog";

const progress = {
  units: [{ id: "u1", order: 1 }, { id: "u2", order: 2 }],
  completedUnitIds: ["u1"],
};

describe("canRevealSpoilerSafeContent", () => {
  it("requires explicit summary-backed evidence and completed reading progress", () => {
    expect(canRevealSpoilerSafeContent({
      sourceId: "src-mistborn-1",
      unlock: { unitId: "u1" },
      evidence: "summary-backed",
    }, privateCosmereSourceCatalog, progress)).toBe(true);
  });

  it("never upgrades catalog or structure evidence into reveal permission", () => {
    for (const evidence of ["unverified", "structure-only"] as const) {
      expect(canRevealSpoilerSafeContent({
        sourceId: "src-mistborn-1",
        unlock: { unitId: "u1" },
        evidence,
      }, privateCosmereSourceCatalog, progress)).toBe(false);
    }
  });

  it("fails closed for missing sources, future units, malformed catalogs, and inconsistent progress", () => {
    expect(canRevealSpoilerSafeContent({
      sourceId: "missing",
      unlock: { unitId: "u1" },
      evidence: "summary-backed",
    }, privateCosmereSourceCatalog, progress)).toBe(false);

    expect(canRevealSpoilerSafeContent({
      sourceId: "src-mistborn-1",
      unlock: { unitId: "u2" },
      evidence: "summary-backed",
    }, privateCosmereSourceCatalog, progress)).toBe(false);

    expect(canRevealSpoilerSafeContent({
      sourceId: "src-mistborn-1",
      unlock: { unitId: "u1" },
      evidence: "summary-backed",
    }, [
      ...privateCosmereSourceCatalog,
      { ...privateCosmereSourceCatalog[0] },
    ], progress)).toBe(false);

    expect(canRevealSpoilerSafeContent({
      sourceId: "src-mistborn-1",
      unlock: { unitId: "u2" },
      evidence: "summary-backed",
    }, privateCosmereSourceCatalog, {
      units: [{ id: "u1" }, { id: "u2" }],
      completedUnitIds: ["u2"],
    })).toBe(false);
  });
});
