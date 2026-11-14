import { evaluateSpoilerGate, reconcileProgress, worksForWorld } from "./cosmereExpansionRun78";

describe("cosmere expansion run78", () => {
  it("does not infer a world from catalog metadata", () => {
    const worlds = [{ id: "scadrial", name: "Scadrial" }];
    const works = [
      { id: "catalog", title: "Título catalogado", sourceId: "index" },
      { id: "explicit", title: "Relación explícita", sourceId: "index", worldId: "scadrial" },
    ];
    expect(worksForWorld("scadrial", works, worlds).map(work => work.id)).toEqual(["explicit"]);
  });
  it("reconciles only explicit units for the requested work", () => {
    const units = [{ id: "a", workId: "work", position: 2 }, { id: "b", workId: "work", position: 1 }, { id: "foreign", workId: "other", position: 1 }];
    expect(reconcileProgress("work", units, [
      { workId: "work", completedUnitIds: ["a", "foreign", "missing", "a"] },
      { workId: "other", completedUnitIds: ["b"] },
    ])).toEqual(["a"]);
  });
  it("fails closed until every explicit requirement is complete", () => {
    const units = [{ id: "one", workId: "work", position: 1 }, { id: "two", workId: "work", position: 2 }];
    expect(evaluateSpoilerGate({ workId: "work", requiredUnitIds: ["one", "two"] }, units, ["one"]))
      .toMatchObject({ unlocked: false, reason: "incomplete-progress", pendingUnitIds: ["two"] });
    expect(evaluateSpoilerGate({ workId: "work", requiredUnitIds: ["one", "two"] }, units, ["one", "two"]))
      .toMatchObject({ unlocked: true, reason: "unlocked" });
  });
  it("blocks malformed requirements", () => {
    const units = [{ id: "one", workId: "work", position: 1 }];
    expect(evaluateSpoilerGate({ workId: "work", requiredUnitIds: [] }, units, []))
      .toMatchObject({ unlocked: false, reason: "empty-requirements" });
    expect(evaluateSpoilerGate({ workId: "work", requiredUnitIds: ["missing"] }, units, []))
      .toMatchObject({ unlocked: false, reason: "unknown-unit" });
  });
});
