import { describe, expect, it } from "vitest";
import { resolveBibliographyWorkAssignments } from "./bibliographyWorkAssignments";

const catalog = [
  { id: "source-a", title: "Declared title A", sourceCollectionId: "private", access: "verified-structure" as const },
  { id: "source-b", title: "Declared title B", sourceCollectionId: "private", access: "verified-structure" as const },
];

describe("resolveBibliographyWorkAssignments", () => {
  it("accepts explicit one-to-one source-to-work metadata", () => {
    const result = resolveBibliographyWorkAssignments(catalog, [
      { sourceId: "source-a", workId: "work-a" },
      { sourceId: "source-b", workId: "work-b" },
    ]);

    expect(result.status).toBe("valid");
    expect(result.assignments).toHaveLength(2);
  });

  it("blocks an unknown source instead of inferring provenance", () => {
    const result = resolveBibliographyWorkAssignments(catalog, [
      { sourceId: "unknown", workId: "work-a" },
    ]);

    expect(result.status).toBe("blocked");
    expect(result.assignments).toEqual([]);
    expect(result.blockedSourceIds).toContain("unknown");
  });

  it("blocks ambiguous duplicate source or work assignments", () => {
    const result = resolveBibliographyWorkAssignments(catalog, [
      { sourceId: "source-a", workId: "work-a" },
      { sourceId: "source-a", workId: "work-b" },
    ]);

    expect(result.status).toBe("blocked");

    const duplicateWork = resolveBibliographyWorkAssignments(catalog, [
      { sourceId: "source-a", workId: "work-a" },
      { sourceId: "source-b", workId: "work-a" },
    ]);
    expect(duplicateWork.status).toBe("blocked");
    expect(duplicateWork.blockedWorkIds).toContain("work-a");
  });
});
