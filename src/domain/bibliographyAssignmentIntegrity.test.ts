import { describe, expect, it } from "vitest";
import { resolveBibliographyAssignmentIntegrity } from "./bibliographyAssignmentIntegrity";

const catalog = [
  { id: "source-a", title: "A", sourceCollectionId: "private", access: "verified-structure" as const },
  { id: "source-b", title: "B", sourceCollectionId: "private", access: "verified-structure" as const },
];

describe("resolveBibliographyAssignmentIntegrity", () => {
  it("accepts explicit work and world metadata for cataloged sources", () => {
    const result = resolveBibliographyAssignmentIntegrity(
      catalog,
      [{ sourceId: "source-a", workId: "work-a" }],
      [{ sourceId: "source-a", worldId: "world-a" }],
    );
    expect(result.status).toBe("valid");
    expect(result.sourceIds).toEqual(["source-a"]);
  });

  it("blocks unknown or duplicated source metadata instead of guessing", () => {
    const unknown = resolveBibliographyAssignmentIntegrity(
      catalog,
      [{ sourceId: "unknown", workId: "work-a" }],
      [],
    );
    expect(unknown.status).toBe("blocked");
    expect(unknown.blockedSourceIds).toContain("unknown");

    const duplicate = resolveBibliographyAssignmentIntegrity(
      catalog,
      [{ sourceId: "source-a", workId: "work-a" }, { sourceId: "source-a", workId: "work-b" }],
      [],
    );
    expect(duplicate.status).toBe("blocked");
  });
});
