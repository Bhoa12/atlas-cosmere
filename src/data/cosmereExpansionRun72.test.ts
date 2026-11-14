import { describe, expect, it } from "vitest";
import { evaluateSpoilerGate, reconcileProgress, validateCatalog, type Catalog } from "./cosmereExpansionRun72";

const catalog: Catalog = {
  sources: [{ id: "index", kind: "verified-index" }],
  worlds: [{ id: "scadrial", name: "Scadrial" }],
  works: [{ id: "work", title: "Synthetic", sourceId: "index" }],
  units: [{ id: "u1", workId: "work", position: 1 }, { id: "u2", workId: "work", position: 2 }],
};

describe("cosmere expansion run 72", () => {
  it("does not infer a world from a title", () => expect(catalog.works[0].worldId).toBeUndefined());
  it("ignores foreign and unknown progress and preserves reading order", () => {
    expect(reconcileProgress(catalog, "work", [
      { workId: "other", completedUnitIds: ["u1"] },
      { workId: "work", completedUnitIds: ["u2", "unknown", "u1", "u1"] },
    ])).toEqual(["u1", "u2"]);
  });
  it("fails closed until every explicit requirement is complete", () => {
    expect(evaluateSpoilerGate(catalog, "work", ["u1", "u2"], [{ workId: "work", completedUnitIds: ["u1"] }]))
      .toMatchObject({ allowed: false, reason: "incomplete", pendingUnitIds: ["u2"] });
    expect(evaluateSpoilerGate(catalog, "work", ["u1", "u2"], [{ workId: "work", completedUnitIds: ["u1", "u2"] }]))
      .toMatchObject({ allowed: true, reason: "ready" });
  });
  it("rejects invalid structural references", () => {
    const broken: Catalog = { ...catalog, works: [{ id: "work", title: "Synthetic", sourceId: "missing" }] };
    expect(validateCatalog(broken)).toContain("work:unknown-source:work");
  });
});
