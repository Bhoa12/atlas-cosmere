import { resolveContentAccessGate } from "./contentAccessGate";

describe("resolveContentAccessGate", () => {
  const valid = { status: "valid" as const, completedUnitIds: ["u1"], pendingUnitIds: [] };

  it("allows only explicitly visible content", () => {
    expect(resolveContentAccessGate(valid, [
      { contentId: "safe", visibility: "visible" },
      { contentId: "later", visibility: "blocked" },
    ], ["safe", "later", "missing"])).toEqual([
      { contentId: "safe", access: "allowed", reason: "visible" },
      { contentId: "later", access: "denied", reason: "visibility-blocked" },
      { contentId: "missing", access: "denied", reason: "unknown-content" },
    ]);
  });

  it("fails closed when progress is blocked", () => {
    expect(resolveContentAccessGate(
      { status: "blocked", completedUnitIds: [], pendingUnitIds: [] },
      [{ contentId: "safe", visibility: "visible" }],
      ["safe"],
    )).toEqual([{ contentId: "safe", access: "denied", reason: "progress-blocked" }]);
  });

  it("fails closed on duplicate visibility metadata", () => {
    expect(resolveContentAccessGate(valid, [
      { contentId: "safe", visibility: "visible" },
      { contentId: "safe", visibility: "visible" },
    ], ["safe"])).toEqual([{ contentId: "safe", access: "denied", reason: "visibility-blocked" }]);
  });
});
