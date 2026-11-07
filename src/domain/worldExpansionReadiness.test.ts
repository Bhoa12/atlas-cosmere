import { resolveWorldExpansionReadiness } from "./worldExpansionReadiness";

describe("resolveWorldExpansionReadiness", () => {
  const base = {
    worldId: "world-a",
    catalogLinks: [{ workId: "work-a", worldId: "world-a" }],
    sources: [{ id: "work-a", title: "A", sourceCollectionId: "private", access: "verified-structure" as const }],
    progressByWorkId: {
      "work-a": {
        units: [{ id: "unit-1", order: 1 }],
        completedUnitIds: ["unit-1"],
      },
    },
  };

  it("reports structural readiness only when all existing gates pass", () => {
    expect(resolveWorldExpansionReadiness(base)).toEqual({
      status: "structure-ready",
      worldId: "world-a",
      workCount: 1,
      verifiedStructure: true,
    });
  });

  it("keeps cataloged sources separate from verified structure", () => {
    const input = { ...base, sources: [{ ...base.sources[0], access: "cataloged" as const }] };
    expect(resolveWorldExpansionReadiness(input)).toMatchObject({
      status: "cataloged",
      worldId: "world-a",
      verifiedStructure: false,
    });
  });

  it("fails closed when bibliographic evidence is incomplete", () => {
    expect(resolveWorldExpansionReadiness({
      ...base,
      sources: [],
    })).toEqual({
      status: "blocked",
      worldId: null,
      workCount: 0,
      verifiedStructure: false,
    });
  });
});
