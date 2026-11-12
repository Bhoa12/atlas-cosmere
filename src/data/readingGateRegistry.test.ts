import { validateReadingGate } from "./readingGateRegistry";

describe("validateReadingGate", () => {
  it("accepts canonical technical gates", () => {
    expect(validateReadingGate({
      id: "gate-example",
      workId: "work-example",
      requiredUnitIds: ["unit-one", "unit-two"],
    })).toEqual(expect.objectContaining({ ok: true }));
  });

  it("rejects malformed identifiers", () => {
    expect(validateReadingGate({
      id: "Gate",
      workId: "work-example",
      requiredUnitIds: [],
    })).toEqual({ ok: false, reason: "non-canonical-id" });
  });

  it("rejects duplicate prerequisites", () => {
    expect(validateReadingGate({
      id: "gate-example",
      workId: "work-example",
      requiredUnitIds: ["unit-one", "unit-one"],
    })).toEqual({ ok: false, reason: "duplicate-required-unit" });
  });
});
