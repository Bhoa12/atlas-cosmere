import { validateCatalogExpansion } from "./catalogExpansionValidation";

describe("validateCatalogExpansion", () => {
  it("aggregates provenance and spoiler diagnostics", () => {
    const issues = validateCatalogExpansion({
      worlds: [],
      provenance: [{ workId: "missing", sourceId: "unknown" }],
      sources: [],
      gates: [{ id: "gate", requirements: [{ workId: "missing", requiredPosition: 1 }] }],
      knownWorkIds: [],
    });
    expect(issues.map((issue) => issue.layer)).toEqual(["provenance", "spoiler_gate"]);
  });
});
