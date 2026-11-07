import { describe, expect, it } from "vitest";
import { resolveSourceBindingCoverage } from "./sourceBindingCoverage";

const catalog = [
  { id: "source-a", title: "A", sourceCollectionId: "private", access: "cataloged" as const },
  { id: "source-b", title: "B", sourceCollectionId: "private", access: "cataloged" as const },
];

describe("resolveSourceBindingCoverage", () => {
  it("reports explicit coverage without inferring missing bindings", () => {
    expect(resolveSourceBindingCoverage(catalog, [{ sourceId: "source-a", workId: "work-a" }])).toEqual({
      status: "valid",
      coveredSourceIds: ["source-a"],
      uncoveredSourceIds: ["source-b"],
      unknownBindingSourceIds: [],
    });
  });

  it("fails closed when a binding names a source outside the catalog", () => {
    expect(resolveSourceBindingCoverage(catalog, [{ sourceId: "unknown", workId: "work-a" }])).toEqual({
      status: "blocked",
      coveredSourceIds: [],
      uncoveredSourceIds: [],
      unknownBindingSourceIds: ["unknown"],
    });
  });

  it("fails closed for malformed provenance registries", () => {
    expect(resolveSourceBindingCoverage(catalog, [{ sourceId: "source-a", workId: "" }])).toMatchObject({
      status: "blocked",
    });
  });
});
