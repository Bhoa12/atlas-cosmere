import { describe, expect, it } from "vitest";
import type { MetadataEvidence } from "./metadataEvidence";
import { canUnlockWithEvidence } from "./evidenceUnlockGate";

describe("canUnlockWithEvidence", () => {
  const verified: MetadataEvidence[] = [
    { evidenceId: "a", sourceId: "source", locator: "index:1", status: "verified" },
    { evidenceId: "b", sourceId: "source", locator: "index:2", status: "verified" },
  ];

  it("unlocks only when every requirement has unique verified evidence", () => {
    expect(
      canUnlockWithEvidence([{ evidenceId: "a" }, { evidenceId: "b" }], verified),
    ).toBe(true);
  });

  it("fails closed for missing, declared-only, or ambiguous evidence", () => {
    expect(canUnlockWithEvidence([{ evidenceId: "missing" }], verified)).toBe(false);
    expect(
      canUnlockWithEvidence([{ evidenceId: "a" }], [
        ...verified,
        { evidenceId: "a", sourceId: "source", locator: "index:3", status: "verified" },
      ]),
    ).toBe(false);
    expect(
      canUnlockWithEvidence([{ evidenceId: "a" }], [
        { evidenceId: "a", sourceId: "source", locator: "index:1", status: "declared" },
      ]),
    ).toBe(false);
  });

  it("never unlocks for empty or duplicate requirements", () => {
    expect(canUnlockWithEvidence([], verified)).toBe(false);
    expect(canUnlockWithEvidence([{ evidenceId: "a" }, { evidenceId: "a" }], verified)).toBe(false);
    expect(canUnlockWithEvidence([{ evidenceId: " " }], verified)).toBe(false);
  });
});
