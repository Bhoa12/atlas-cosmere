import { evaluateSpoilerGate } from "./cosmereExpansionRun53";

const units=[{id:"u1",workId:"w",order:1},{id:"u2",workId:"w",order:2}];

describe("evaluateSpoilerGate",()=>{
  it("fails closed for incomplete progress",()=>expect(evaluateSpoilerGate({workId:"w",requiredUnitIds:["u1","u2"]},units,{workId:"w",completedUnitIds:["u1"]}).revealed).toBe(false));
  it("reveals only after every requirement",()=>expect(evaluateSpoilerGate({workId:"w",requiredUnitIds:["u1","u2"]},units,{workId:"w",completedUnitIds:["u1","u2"]}).revealed).toBe(true));
  it("rejects duplicate requirements",()=>expect(evaluateSpoilerGate({workId:"w",requiredUnitIds:["u1","u1"]},units,{workId:"w",completedUnitIds:["u1"]}).revealed).toBe(false));
});
