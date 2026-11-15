import { describe, expect, it } from "vitest";
import {
  auditExpansionManifest,
  isGateUnlocked,
  reconcileManifestProgress,
  type ExpansionManifest,
} from "./cosmereExpansionRun93";

const manifest: ExpansionManifest = {
  sources: [
    { id: "catalog", kind: "verified-index", accessible: true },
    { id: "editorial", kind: "editorial-accessible", accessible: true },
    { id: "private", kind: "declared-private", accessible: false },
  ],
  worlds: [{ id: "scadrial", sourceId: "catalog" }],
  works: [{ id: "work-a", sourceId: "catalog" }],
  links: [{ workId: "work-a", worldId: "scadrial", sourceId: "catalog" }],
  units: [
    { id: "u1", workId: "work-a", position: 1, sourceId: "editorial" },
    { id: "u2", workId: "work-a", position: 2, sourceId: "editorial" },
    { id: "private-unit", workId: "work-a", position: 3, sourceId: "private" },
  ],
  gates: [{ id: "after-u2", workId: "work-a", requiredUnitIds: ["u1", "u2"] }],
};

describe("cosmere expansion run 93", () => {
  it("accepts catalog metadata but requires accessible editorial backing for reading units", () => {
    const audit = auditExpansionManifest(manifest);
    expect(audit.validWorkIds).toEqual(["work-a"]);
    expect(audit.validUnitIds).toEqual(["u1", "u2"]);
    expect(audit.errors).toContain("invalid-unit:private-unit");
  });

  it("reconciles progress by work and explicit reading order", () => {
    expect(reconcileManifestProgress("work-a", ["u2", "u1", "unknown"], manifest))
      .toEqual(["u1", "u2"]);
  });

  it("keeps spoiler gates closed until every validated requirement is complete", () => {
    expect(isGateUnlocked("after-u2", ["u1"], manifest)).toBe(false);
    expect(isGateUnlocked("after-u2", ["u2", "u1"], manifest)).toBe(true);
  });

  it("fails closed for empty or duplicate requirements", () => {
    const invalid = {
      ...manifest,
      gates: [
        { id: "empty", workId: "work-a", requiredUnitIds: [] },
        { id: "duplicate", workId: "work-a", requiredUnitIds: ["u1", "u1"] },
      ],
    };
    expect(isGateUnlocked("empty", ["u1", "u2"], invalid)).toBe(false);
    expect(isGateUnlocked("duplicate", ["u1", "u2"], invalid)).toBe(false);
  });
});
