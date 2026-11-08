import { describe, expect, it } from "vitest";
import { resolveSourceProvenanceCoverage } from "./sourceProvenanceCoverage";

const catalog = [
  { id: "source-a", title: "Catalog entry A", sourceCollectionId: "private", access: "cataloged" as const },
  { id: "source-b", title: "Catalog entry B", sourceCollectionId: "private", access: "verified-structure" as const },
];

describe("resolveSourceProvenanceCoverage", () => {
  it("accepts complete explicit coverage without inspecting narrative text", () => {
    expect(resolveSourceProvenanceCoverage(
      ["work-a", "work-b"],
      catalog,
      [{ sourceId: "source-a", workId: "work-a" }, { sourceId: "source-b", workId: "work-b" }],
    )).toEqual({ status: "complete", uncoveredWorkIds: [] });
  });

  it("reports declared works lacking an explicit source binding", () => {
    expect(resolveSourceProvenanceCoverage(
      ["work-a", "work-b"],
      catalog,
      [{ sourceId: "source-a", workId: "work-a" }],
    )).toEqual({ status: "incomplete", uncoveredWorkIds: ["work-b"] });
  });

  it("fails closed for duplicate work declarations or unknown sources", () => {
    expect(resolveSourceProvenanceCoverage(
      ["work-a", "work-a"],
      catalog,
      [{ sourceId: "source-a", workId: "work-a" }],
    ).status).toBe("blocked");

    expect(resolveSourceProvenanceCoverage(
      ["work-a"],
      catalog,
      [{ sourceId: "missing", workId: "work-a" }],
    ).status).toBe("blocked");
  });
});
