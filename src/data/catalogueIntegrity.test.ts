import { validateCatalogueIntegrity } from "./catalogueIntegrity";

const sources = [
  { id: "cosmere-index", status: "verified-index" as const },
  { id: "roshar-private", status: "declared-private" as const },
];

describe("validateCatalogueIntegrity", () => {
  it("accepts metadata with known provenance", () => {
    expect(validateCatalogueIntegrity(sources, [
      { id: "example-work", title: "Example", sourceId: "cosmere-index" },
    ])).toEqual({ valid: true, errors: [] });
  });

  it("rejects duplicate works and unknown sources", () => {
    const result = validateCatalogueIntegrity(sources, [
      { id: "example-work", title: "Example", sourceId: "cosmere-index" },
      { id: "example-work", title: "Other", sourceId: "missing-source" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("invalid work: example-work");
    expect(result.errors).toContain("unknown source: missing-source");
  });
});
