import { describe, expect, it } from "vitest";
import { canRevealWorkScopedEvidenceContent } from "./workScopedEvidenceSpoilerGate";

describe("canRevealWorkScopedEvidenceContent", () => {
  const sources = [{ sourceId: "cosmere", title: "Declared source", availability: "declared" as const }];
  const evidence = [{
    evidenceId: "summary-1",
    sourceId: "cosmere",
    kind: "summary" as const,
    summaryId: "original-summary-1",
  }];
  const base = {
    sourceId: "cosmere",
    evidenceId: "summary-1",
    worldId: "scadrial",
    contentWorldId: "scadrial",
    workId: "mistborn-era-1",
    contentWorkId: "mistborn-era-1",
    requiredPosition: 2,
    safeCompletedPositions: 2,
    declaredPositions: 3,
  };

  it("requires both registered summary evidence and matching work scope", () => {
    expect(canRevealWorkScopedEvidenceContent(base, sources, evidence)).toBe(true);
  });

  it("fails closed for a different work even with valid evidence", () => {
    expect(canRevealWorkScopedEvidenceContent({
      ...base,
      contentWorkId: "another-work",
    }, sources, evidence)).toBe(false);
  });

  it("fails closed for missing summary evidence", () => {
    expect(canRevealWorkScopedEvidenceContent({
      ...base,
      evidenceId: "missing",
    }, sources, evidence)).toBe(false);
  });

  it("fails closed for future positions", () => {
    expect(canRevealWorkScopedEvidenceContent({
      ...base,
      requiredPosition: 3,
    }, sources, evidence)).toBe(false);
  });
});
