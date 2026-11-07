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
  const bindings = [{ sourceId: "cosmere", workId: "mistborn-era-1" }];
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

  it("requires registered evidence, matching scope and explicit source provenance", () => {
    expect(canRevealWorkScopedEvidenceContent(base, sources, evidence, bindings)).toBe(true);
  });

  it("fails closed for a different work even with valid evidence", () => {
    expect(canRevealWorkScopedEvidenceContent({
      ...base,
      contentWorkId: "another-work",
    }, sources, evidence, bindings)).toBe(false);
  });

  it("fails closed for missing summary evidence", () => {
    expect(canRevealWorkScopedEvidenceContent({
      ...base,
      evidenceId: "missing",
    }, sources, evidence, bindings)).toBe(false);
  });

  it("fails closed when evidence source is not explicitly bound to the work", () => {
    expect(canRevealWorkScopedEvidenceContent(base, sources, evidence, [
      { sourceId: "cosmere", workId: "another-work" },
    ])).toBe(false);
  });

  it("fails closed for future positions", () => {
    expect(canRevealWorkScopedEvidenceContent({
      ...base,
      requiredPosition: 3,
    }, sources, evidence, bindings)).toBe(false);
  });
});
