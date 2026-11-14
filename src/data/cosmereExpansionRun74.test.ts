import { canReveal, reconcileProgress, validateCatalog } from "./cosmereExpansionRun74";

const sources = [{ id: "index", access: "verified-index" as const }, { id: "open", access: "accessible" as const }];
const worlds = [{ id: "scadrial", name: "Scadrial" }];
const works = [{ id: "w", title: "Synthetic", sourceId: "index", worldIds: [] }];
const units = [{ id: "u1", workId: "w", position: 1 }, { id: "u2", workId: "w", position: 2 }];

describe("run74 catalog and spoilers", () => {
  it("does not infer worlds and validates explicit structure", () => {
    expect(validateCatalog(sources, worlds, works, units)).toEqual([]);
    expect(works[0].worldIds).toEqual([]);
  });
  it("reconciles only known progress for the correct work", () => {
    expect(reconcileProgress("w", units, [{ workId: "w", completedUnitIds: ["u2", "missing", "u1", "u1"] }, { workId: "other", completedUnitIds: ["u1"] }])).toEqual(["u1", "u2"]);
  });
  it("fails closed for summaries without accessible provenance or incomplete reading", () => {
    expect(canReveal({ id:"c", workId:"w", sourceId:"index", kind:"backed-summary", summary:"Original synthetic summary.", requiresUnitIds:["u1"] }, sources, units, [{ workId:"w", completedUnitIds:["u1"] }]).reveal).toBe(false);
    expect(canReveal({ id:"c", workId:"w", sourceId:"open", kind:"backed-summary", summary:"Original synthetic summary.", requiresUnitIds:["u1","u2"] }, sources, units, [{ workId:"w", completedUnitIds:["u1"] }]).reason).toBe("incomplete");
  });
});
