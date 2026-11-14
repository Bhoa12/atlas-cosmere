import { describe, expect, it } from "vitest";
import { evaluateSpoilerGate, reconcileProgress, worksForWorld } from "./cosmereExpansionRun80";

describe("cosmere expansion run 80", () => {
  const works=[{id:"a",title:"A",sourceId:"s"},{id:"b",title:"B",sourceId:"s"}];
  const links=[{worldId:"scadrial",workId:"a",sourceId:"s"}];
  const units=[{id:"u1",workId:"a",position:2,sourceId:"x"},{id:"u0",workId:"a",position:1,sourceId:"x"},{id:"foreign",workId:"b",position:1,sourceId:"x"}];

  it("navigates only through explicit world links", () => {
    expect(worksForWorld("scadrial",links,works).map(w=>w.id)).toEqual(["a"]);
  });

  it("reconciles known units in reading order", () => {
    expect(reconcileProgress("a",[{workId:"a",completedUnitIds:["u1","unknown"]},{workId:"b",completedUnitIds:["foreign"]},{workId:"a",completedUnitIds:["u0","u1"]}],units)).toEqual(["u0","u1"]);
  });

  it("fails closed for malformed gates and unlocks only after all requirements", () => {
    expect(evaluateSpoilerGate({workId:"a",requiredUnitIds:["u0","u0"]},[],units).unlocked).toBe(false);
    expect(evaluateSpoilerGate({workId:"a",requiredUnitIds:["u0","u1"]},[{workId:"a",completedUnitIds:["u0"]}],units)).toEqual({unlocked:false,pendingUnitIds:["u1"]});
    expect(evaluateSpoilerGate({workId:"a",requiredUnitIds:["u0","u1"]},[{workId:"a",completedUnitIds:["u0","u1"]}],units).unlocked).toBe(true);
  });
});
