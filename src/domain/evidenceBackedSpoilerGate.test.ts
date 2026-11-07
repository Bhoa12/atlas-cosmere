import { describe, expect, it } from "vitest";
import { canRevealEvidenceBackedContent } from "./evidenceBackedSpoilerGate";

const sources = [{ sourceId: "src-1", title: "Catalogued work", availability: "declared" as const }];
const evidence = [{ evidenceId: "ev-1", sourceId: "src-1", kind: "summary" as const, summaryId: "sum-1" }];
const progress = { units: [{ id: "u1", order: 1 }, { id: "u2", order: 2 }], completedUnitIds: ["u1"] };
const descriptor = { sourceId: "src-1", evidenceId: "ev-1", unlock: { unitId: "u1" } };

describe("evidence-backed spoiler gate", () => {
  it("allows disclosure only after registered summary evidence and required progress", () => {
    expect(canRevealEvidenceBackedContent(descriptor, sources, evidence, progress)).toBe(true);
  });

  it("rejects metadata, unknown evidence, and future units", () => {
    expect(canRevealEvidenceBackedContent(descriptor, sources, [{
      evidenceId: "ev-1", sourceId: "src-1", kind: "metadata" as const,
    }], progress)).toBe(false);

    expect(canRevealEvidenceBackedContent({
      ...descriptor,
      evidenceId: "missing",
      unlock: { unitId: "u2" },
    }, sources, evidence, progress)).toBe(false);
  });

  it("fails closed for an unknown source", () => {
    expect(canRevealEvidenceBackedContent({
      ...descriptor,
      sourceId: "missing",
    }, sources, evidence, progress)).toBe(false);
  });
});
