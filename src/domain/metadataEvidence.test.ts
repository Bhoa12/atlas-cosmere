import { describe, expect, it } from "vitest";
import { resolveVerifiedMetadata, type EvidenceBackedValue, type MetadataEvidence } from "./metadataEvidence";

describe("resolveVerifiedMetadata", () => {
  const values: EvidenceBackedValue<string>[] = [
    { value: "safe", evidenceId: "verified" },
    { value: "declared-only", evidenceId: "declared" },
    { value: "ambiguous", evidenceId: "duplicate" },
    { value: "missing", evidenceId: "missing" },
  ];

  it("returns only uniquely verified metadata", () => {
    const evidence: MetadataEvidence[] = [
      { evidenceId: "verified", sourceId: "src", locator: "metadata:index:1", status: "verified" },
      { evidenceId: "declared", sourceId: "src", locator: "metadata:index:2", status: "declared" },
      { evidenceId: "duplicate", sourceId: "src", locator: "metadata:index:3", status: "verified" },
      { evidenceId: "duplicate", sourceId: "src", locator: "metadata:index:4", status: "verified" },
    ];

    expect(resolveVerifiedMetadata(values, evidence)).toEqual(["safe"]);
  });

  it("fails closed for malformed evidence", () => {
    const evidence: MetadataEvidence[] = [
      { evidenceId: "verified", sourceId: "", locator: "metadata:index:1", status: "verified" },
    ];

    expect(resolveVerifiedMetadata(values, evidence)).toEqual([]);
  });
});
