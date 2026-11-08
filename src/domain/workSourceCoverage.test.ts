import { resolveWorkSourceCoverage } from "./workSourceCoverage";

const catalog = [
  { id: "a", title: "A", sourceCollectionId: "private", access: "cataloged" as const },
  { id: "b", title: "B", sourceCollectionId: "private", access: "cataloged" as const },
];

describe("resolveWorkSourceCoverage", () => {
  it("groups multiple explicit sources for one work", () => {
    expect(resolveWorkSourceCoverage(catalog, [
      { sourceId: "a", workId: "work-1" },
      { sourceId: "b", workId: "work-1" },
    ])).toEqual({
      status: "valid",
      workIds: ["work-1"],
      sourceIdsByWork: { "work-1": ["a", "b"] },
      unknownBindingSourceIds: [],
    });
  });

  it("blocks unknown sources", () => {
    expect(resolveWorkSourceCoverage(catalog, [
      { sourceId: "missing", workId: "work-1" },
    ]).status).toBe("blocked");
  });

  it("blocks duplicate source provenance", () => {
    expect(resolveWorkSourceCoverage(catalog, [
      { sourceId: "a", workId: "work-1" },
      { sourceId: "a", workId: "work-2" },
    ]).status).toBe("blocked");
  });
});
