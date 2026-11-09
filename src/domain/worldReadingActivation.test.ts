import { resolveWorldReadingActivation } from "./worldReadingActivation";

describe("resolveWorldReadingActivation", () => {
  const execution = [
    { worldId: "scadrial", executable: true, reason: "approved" as const },
    { worldId: "sel", executable: false, reason: "awaiting-catalog" as const },
  ];

  it("activates reading only when execution and explicit coverage both allow it", () => {
    expect(resolveWorldReadingActivation(execution, { scadrial: true, sel: true })).toEqual([
      { worldId: "scadrial", readingReady: true, reason: "activated" },
      { worldId: "sel", readingReady: false, reason: "not-executable" },
    ]);
  });

  it("keeps executable worlds inactive when coverage is missing", () => {
    expect(resolveWorldReadingActivation(execution, { sel: true })).toContainEqual(
      { worldId: "scadrial", readingReady: false, reason: "missing-coverage" },
    );
  });

  it("fails closed for duplicate worlds or unknown coverage keys", () => {
    expect(resolveWorldReadingActivation(
      [...execution, { worldId: "scadrial", executable: true, reason: "approved" }],
      { scadrial: true, sel: true },
    ).every((entry) => entry.reason === "blocked")).toBe(true);

    expect(resolveWorldReadingActivation(execution, { scadrial: true, nalthis: true })
      .every((entry) => entry.reason === "blocked")).toBe(true);
  });
});
