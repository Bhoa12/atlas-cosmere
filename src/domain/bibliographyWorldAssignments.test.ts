import { describe, expect, it } from "vitest";
import { resolveBibliographyWorldAssignments } from "./bibliographyWorldAssignments";

const catalog = [
  { id: "source-a", title: "Declared title", sourceCollectionId: "private", access: "verified-structure" as const },
];

describe("resolveBibliographyWorldAssignments", () => {
  it("accepts an explicit assignment for a catalog source", () => {
    const result = resolveBibliographyWorldAssignments(catalog, [
      { sourceId: "source-a", worldId: "world-a" },
    ]);
    expect(result.status).toBe("valid");
    expect(result.assignments).toHaveLength(1);
  });

  it("blocks unknown sources instead of inferring provenance", () => {
    const result = resolveBibliographyWorldAssignments(catalog, [
      { sourceId: "unknown", worldId: "world-a" },
    ]);
    expect(result.status).toBe("blocked");
    expect(result.assignments).toEqual([]);
    expect(result.blockedSourceIds).toContain("unknown");
  });

  it("blocks duplicate assignments for the same source", () => {
    const result = resolveBibliographyWorldAssignments(catalog, [
      { sourceId: "source-a", worldId: "world-a" },
      { sourceId: "source-a", worldId: "world-b" },
    ]);
    expect(result.status).toBe("blocked");
    expect(result.assignments).toEqual([]);
  });
});
