import { hasVerifiedWorldReadingCoverage } from "./worldReadingCoverage";

const units = [{ id: "u1", order: 1 }];

describe("hasVerifiedWorldReadingCoverage", () => {
  const base = {
    worldId: "scadrial",
    catalogLinks: [{ workId: "mistborn-1", worldId: "scadrial" }],
    sources: [{ id: "mistborn-1", title: "Cataloged title", sourceCollectionId: "private", access: "verified-structure" as const }],
    progressByWorkId: { "mistborn-1": { units, completedUnitIds: [] } },
  };

  it("accepts structurally verified coverage", () => {
    expect(hasVerifiedWorldReadingCoverage(base)).toBe(true);
  });

  it("rejects catalog-only sources", () => {
    expect(hasVerifiedWorldReadingCoverage({
      ...base,
      sources: [{ ...base.sources[0], access: "cataloged" }],
    })).toBe(false);
  });

  it("rejects missing or inconsistent progress", () => {
    expect(hasVerifiedWorldReadingCoverage({
      ...base,
      progressByWorkId: { "mistborn-1": { units, completedUnitIds: ["unknown"] } },
    })).toBe(false);
  });

  it("fails closed when a linked work has no source evidence", () => {
    expect(hasVerifiedWorldReadingCoverage({ ...base, sources: [] })).toBe(false);
  });
});
