import { resolveBibliographySourceCoverage } from "./bibliographySourceCoverage";

const catalog = [
  { id: "a", title: "A", sourceCollectionId: "private", access: "verified-structure" as const },
  { id: "b", title: "B", sourceCollectionId: "private", access: "verified-structure" as const },
];

describe("resolveBibliographySourceCoverage", () => {
  it("reports complete coverage for explicit assignments", () => {
    expect(resolveBibliographySourceCoverage(catalog, [
      { sourceCollectionId: "private", sourceIds: ["a", "b"] },
    ])).toEqual({ status: "complete", uncoveredSourceIds: [] });
  });

  it("reports incomplete coverage without inferring a collection", () => {
    expect(resolveBibliographySourceCoverage(catalog, [
      { sourceCollectionId: "private", sourceIds: ["a"] },
    ])).toEqual({ status: "incomplete", uncoveredSourceIds: ["b"] });
  });

  it("blocks duplicate source assignments", () => {
    expect(resolveBibliographySourceCoverage(catalog, [
      { sourceCollectionId: "one", sourceIds: ["a"] },
      { sourceCollectionId: "two", sourceIds: ["a"] },
    ])).toEqual({ status: "blocked", uncoveredSourceIds: [] });
  });

  it("blocks assignments to unknown sources", () => {
    expect(resolveBibliographySourceCoverage(catalog, [
      { sourceCollectionId: "private", sourceIds: ["missing"] },
    ])).toEqual({ status: "blocked", uncoveredSourceIds: [] });
  });
});
