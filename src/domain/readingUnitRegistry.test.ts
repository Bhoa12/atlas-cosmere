import { hasReadingUnit, resolveReadingUnitRegistry } from "./readingUnitRegistry";

describe("resolveReadingUnitRegistry", () => {
  const works = ["work-a", "work-b"];

  it("accepts explicit structural units and returns deterministic order", () => {
    expect(resolveReadingUnitRegistry(works, [
      { id: "b-1", workId: "work-b", position: 0 },
      { id: "a-2", workId: "work-a", position: 1 },
      { id: "a-1", workId: "work-a", position: 0 },
    ])).toEqual({ status: "valid", units: [
      { id: "a-1", workId: "work-a", position: 0 },
      { id: "a-2", workId: "work-a", position: 1 },
      { id: "b-1", workId: "work-b", position: 0 },
    ] });
  });

  it("fails closed for duplicate ids, positions, or undeclared works", () => {
    expect(resolveReadingUnitRegistry(works, [
      { id: "x", workId: "work-a", position: 0 },
      { id: "x", workId: "work-b", position: 0 },
    ]).status).toBe("blocked");
    expect(resolveReadingUnitRegistry(works, [
      { id: "x", workId: "work-a", position: 0 },
      { id: "y", workId: "work-a", position: 0 },
    ]).status).toBe("blocked");
    expect(resolveReadingUnitRegistry(works, [{ id: "x", workId: "missing", position: 0 }]).status).toBe("blocked");
  });

  it("does not infer units from identifiers", () => {
    expect(hasReadingUnit(works, [], "chapter-1")).toBe(false);
  });
});
