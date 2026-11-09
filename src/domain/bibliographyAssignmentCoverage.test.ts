import { describe, expect, it } from "vitest";
import { resolveBibliographyAssignmentCoverage } from "./bibliographyAssignmentCoverage";

const catalog = [
  { id: "source-a", title: "A", sourceCollectionId: "private", access: "verified-structure" as const },
  { id: "source-b", title: "B", sourceCollectionId: "private", access: "verified-structure" as const },
];

describe("resolveBibliographyAssignmentCoverage", () => {
  it("requires explicit work and world coverage for every catalog source", () => {
    const result = resolveBibliographyAssignmentCoverage(
      catalog,
      [{ sourceId: "source-a", workId: "work-a" }, { sourceId: "source-b", workId: "work-b" }],
      [{ sourceId: "source-a", worldId: "world-a" }, { sourceId: "source-b", worldId: "world-b" }],
    );

    expect(result.status).toBe("complete");
    expect(result.coveredSourceIds).toEqual(["source-a", "source-b"]);
  });

  it("reports structurally valid partial coverage without guessing missing metadata", () => {
    const result = resolveBibliographyAssignmentCoverage(
      catalog,
      [{ sourceId: "source-a", workId: "work-a" }],
      [{ sourceId: "source-a", worldId: "world-a" }],
    );

    expect(result.status).toBe("incomplete");
    expect(result.uncoveredSourceIds).toEqual(["source-b"]);
  });

  it("blocks the entire reconciliation when assignments are ambiguous or unknown", () => {
    const result = resolveBibliographyAssignmentCoverage(
      catalog,
      [{ sourceId: "unknown", workId: "work-a" }],
      [],
    );

    expect(result.status).toBe("blocked");
    expect(result.coveredSourceIds).toEqual([]);
    expect(result.uncoveredSourceIds).toEqual([]);
    expect(result.blockedSourceIds).toContain("unknown");
  });
});
