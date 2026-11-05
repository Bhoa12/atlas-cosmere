import { describe, expect, it } from "vitest";
import { validateCompositeSpoilerGates } from "./spoilerGateValidation";

describe("validateCompositeSpoilerGates", () => {
  it("accepts explicit gates scoped to known works", () => {
    expect(validateCompositeSpoilerGates([
      { id: "gate-a", requirements: [{ workId: "work-a", requiredPosition: 1 }] },
    ], ["work-a"])).toEqual([]);
  });

  it("reports structural problems without inventing replacements", () => {
    const issues = validateCompositeSpoilerGates([
      { id: "gate-a", requirements: [] },
      { id: "gate-a", requirements: [
        { workId: "missing", requiredPosition: 2 },
        { workId: "missing", requiredPosition: 2 },
      ] },
    ], []);
    expect(issues).toEqual(expect.arrayContaining([
      { type: "empty_gate", gateId: "gate-a" },
      { type: "duplicate_gate_id", gateId: "gate-a" },
      { type: "unknown_work", gateId: "gate-a", workId: "missing" },
      { type: "duplicate_requirement", gateId: "gate-a", workId: "missing", requiredPosition: 2 },
    ]));
  });
});
