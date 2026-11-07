import { describe, expect, it } from "vitest";
import {
  hasRegisteredSummaryEvidence,
  validateNarrativeEvidenceRegistry,
} from "./narrativeEvidenceRegistry";

describe("narrative evidence registry", () => {
  const records = [{
    evidenceId: "ev-1",
    sourceId: "src-example",
    kind: "summary" as const,
    summaryId: "summary-example",
  }];

  it("accepts explicit summary provenance without storing narrative text", () => {
    expect(validateNarrativeEvidenceRegistry(records)).toEqual([]);
    expect(hasRegisteredSummaryEvidence("ev-1", "src-example", records)).toBe(true);
  });

  it("never treats metadata evidence as narrative permission", () => {
    expect(hasRegisteredSummaryEvidence("ev-meta", "src-example", [{
      evidenceId: "ev-meta",
      sourceId: "src-example",
      kind: "metadata",
    }])).toBe(false);
  });

  it("fails closed for duplicate or malformed evidence", () => {
    expect(validateNarrativeEvidenceRegistry([
      ...records,
      { ...records[0] },
    ]).length).toBeGreaterThan(0);

    expect(hasRegisteredSummaryEvidence("ev-1", "src-example", [{
      evidenceId: "ev-1",
      sourceId: "src-example",
      kind: "summary",
    }])).toBe(false);
  });
});
