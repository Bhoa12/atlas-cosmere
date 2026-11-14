import {
  spoilerGate, reconcileProgress, safeReadingUnits, worksForWorld,
} from "./cosmereExpansionRun85";

describe("cosmere expansion run 85", () => {
  const sources = [
    { id: "index", capability: "catalog" as const, accessible: true },
    { id: "private", capability: "private-declared" as const, accessible: false },
    { id: "editorial", capability: "editorial-accessible" as const, accessible: true },
  ];

  it("requires explicit world links", () => {
    const works = [{ id: "a", title: "A", sourceId: "index" }];
    expect(worksForWorld("scadrial", works, [], sources)).toEqual([]);
    expect(worksForWorld("scadrial", works, [{ worldId: "scadrial", workId: "a", sourceId: "index" }], sources)).toEqual(works);
  });

  it("does not accept private-uninspected reading structure", () => {
    expect(safeReadingUnits([
      { id: "u1", workId: "a", position: 1, sourceId: "private" },
      { id: "u2", workId: "a", position: 2, sourceId: "editorial" },
    ], sources).map(unit => unit.id)).toEqual(["u2"]);
  });

  it("reconciles only known progress for the requested work", () => {
    const units = [
      { id: "u1", workId: "a", position: 2, sourceId: "editorial" },
      { id: "u2", workId: "a", position: 1, sourceId: "editorial" },
      { id: "other", workId: "b", position: 1, sourceId: "editorial" },
    ];
    expect(reconcileProgress("a", units, [
      { workId: "a", completedUnitIds: ["u1", "unknown", "u1"] },
      { workId: "b", completedUnitIds: ["other"] },
    ])).toEqual(["u1"]);
  });

  it("fails closed for malformed or incomplete spoiler requirements", () => {
    expect(spoilerGate([], [], ["u1"]).unlocked).toBe(false);
    expect(spoilerGate(["u1", "u1"], ["u1"], ["u1"]).unlocked).toBe(false);
    expect(spoilerGate(["u1", "u2"], ["u1"], ["u1", "u2"])).toEqual({ unlocked: false, pending: ["u2"] });
    expect(spoilerGate(["u1"], ["u1"], ["u1"]).unlocked).toBe(true);
  });
});
