import { auditCatalogNavigation } from "./cosmereCatalogNavigation";

const base = {
  worlds: [{ id: "scadrial", name: "Scadrial" }, { id: "sel", name: "Sel" }],
  works: [{ id: "work-a", title: "Catalog title", sourceId: "index" }],
  assignments: [{ workId: "work-a", worldId: "scadrial", sourceId: "index" }],
  units: [
    { id: "u2", workId: "work-a", position: 2, sourceId: "editorial", accessible: true },
    { id: "u1", workId: "work-a", position: 1, sourceId: "editorial", accessible: true },
  ],
};

describe("auditCatalogNavigation", () => {
  it("uses only explicit relationships and sorts explicit units", () => {
    const report = auditCatalogNavigation(base);
    expect(report.valid).toBe(true);
    expect(report.worksByWorld.scadrial).toEqual(["work-a"]);
    expect(report.unitsByWork["work-a"]).toEqual(["u1", "u2"]);
  });

  it("rejects duplicate assignments and inaccessible units", () => {
    const report = auditCatalogNavigation({
      ...base,
      assignments: [...base.assignments, ...base.assignments],
      units: [...base.units, { id: "hidden", workId: "work-a", position: 3, sourceId: "private", accessible: false }],
    });
    expect(report.valid).toBe(false);
    expect(report.duplicateAssignmentKeys).toEqual(["work-a::scadrial"]);
    expect(report.invalidUnits.map(unit => unit.id)).toContain("hidden");
  });

  it("does not create navigation for unknown worlds or works", () => {
    const report = auditCatalogNavigation({
      ...base,
      assignments: [{ workId: "unknown", worldId: "unknown-world", sourceId: "index" }],
      units: [],
    });
    expect(report.worksByWorld).toEqual({});
    expect(report.unitsByWork).toEqual({});
  });
});
