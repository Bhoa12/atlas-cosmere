import {
  evaluateSourceReference,
  mayAuthorEditorialSummary,
} from "./sourceProvenanceBoundary";

describe("source provenance boundary", () => {
  it("accepts canonical verified-index references", () => {
    expect(evaluateSourceReference({
      sourceId: "cosmere-epub",
      availability: "verified-index",
    })).toEqual({ accepted: true, reason: "source-reference-accepted" });
    expect(mayAuthorEditorialSummary({
      sourceId: "cosmere-epub",
      availability: "verified-index",
    })).toBe(true);
  });

  it("catalogues declared private sources without treating them as inspected", () => {
    const reference = {
      sourceId: "roshar-private-epubs",
      availability: "declared-private" as const,
    };
    expect(evaluateSourceReference(reference).accepted).toBe(true);
    expect(mayAuthorEditorialSummary(reference)).toBe(false);
  });

  it("fails closed for unavailable or malformed sources", () => {
    expect(evaluateSourceReference({
      sourceId: "bad id",
      availability: "verified-index",
    }).accepted).toBe(false);
    expect(evaluateSourceReference({
      sourceId: "missing-source",
      availability: "unavailable",
    }).accepted).toBe(false);
  });
});
