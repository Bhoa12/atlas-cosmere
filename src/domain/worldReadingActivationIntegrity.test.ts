import { resolveWorldReadingActivationIntegrity } from "./worldReadingActivationIntegrity";

describe("resolveWorldReadingActivationIntegrity", () => {
  it("accepts internally consistent unique activation records", () => {
    expect(resolveWorldReadingActivationIntegrity([
      { worldId: "scadrial", readingReady: true, reason: "activated" },
      { worldId: "sel", readingReady: false, reason: "missing-coverage" },
    ])).toEqual({ valid: true, duplicateWorldIds: [], invalidEntries: [] });
  });

  it("rejects duplicate worlds", () => {
    const result = resolveWorldReadingActivationIntegrity([
      { worldId: "scadrial", readingReady: true, reason: "activated" },
      { worldId: "scadrial", readingReady: false, reason: "blocked" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.duplicateWorldIds).toEqual(["scadrial"]);
  });

  it("rejects contradictory activation states", () => {
    const result = resolveWorldReadingActivationIntegrity([
      { worldId: "nalthis", readingReady: true, reason: "missing-coverage" },
      { worldId: "", readingReady: false, reason: "blocked" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.invalidEntries).toEqual(["nalthis", ""]);
  });
});
