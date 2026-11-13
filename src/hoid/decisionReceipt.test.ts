import { describe, expect, it } from "vitest";
import { createHoidDecisionReceipt } from "./decisionReceipt";

describe("createHoidDecisionReceipt", () => {
  it("keeps normalized metadata without narrative prose", () => {
    expect(createHoidDecisionReceipt({
      outcome: "limited",
      boundary: "response",
      reason: "unsupported-evidence",
      bookId: " mistborn-era-1 ",
      chapter: 12,
      evidenceIds: ["mistborn:12:summary", "mistborn:12:summary"],
    })).toEqual({
      outcome: "limited",
      boundary: "response",
      reason: "unsupported-evidence",
      bookId: "mistborn-era-1",
      chapter: 12,
      evidenceIds: ["mistborn:12:summary"],
    });
  });

  it("rejects free-form reasons that could carry spoilers", () => {
    expect(createHoidDecisionReceipt({
      outcome: "blocked",
      boundary: "response",
      reason: "The future revelation is hidden",
    })).toBeNull();
  });

  it("rejects unknown outcomes and boundaries", () => {
    expect(createHoidDecisionReceipt({
      outcome: "allowed",
      boundary: "unknown",
      reason: "invalid",
    })).toBeNull();
  });

  it("omits malformed optional metadata", () => {
    expect(createHoidDecisionReceipt({
      outcome: "abstain",
      boundary: "retrieval",
      reason: "source-unavailable",
      chapter: -1,
      evidenceIds: ["valid:id", "not valid evidence prose"],
    })).toEqual({
      outcome: "abstain",
      boundary: "retrieval",
      reason: "source-unavailable",
    });
  });
});
