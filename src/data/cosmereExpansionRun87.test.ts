import { describe, expect, it } from "vitest";
import { evaluateSpoilerGate, reconcileProgress, validReadingUnits } from "./cosmereExpansionRun87";

describe("cosmere expansion run87", () => {
  const sources=[{id:"catalog",kind:"verified-index" as const,accessible:true},{id:"text",kind:"editorial-accessible" as const,accessible:true}];
  const units=[{id:"u1",workId:"w1",position:1,sourceId:"text"},{id:"u2",workId:"w1",position:2,sourceId:"text"}];
  it("rejects index-only reading structure",()=>expect(validReadingUnits([{id:"bad",workId:"w1",position:3,sourceId:"catalog"}],sources)).toEqual([]));
  it("isolates progress by work and orders valid units",()=>expect(reconcileProgress("w1",units,{workId:"w1",completedUnitIds:["u2","unknown","u1","u1"]})).toEqual(["u1","u2"]));
  it("fails closed for malformed gates",()=>expect(evaluateSpoilerGate({requiredUnitIds:["u1","u1"]},["u1"],units).unlocked).toBe(false));
  it("unlocks only after every requirement",()=>expect(evaluateSpoilerGate({requiredUnitIds:["u1","u2"]},["u1","u2"],units).unlocked).toBe(true));
});