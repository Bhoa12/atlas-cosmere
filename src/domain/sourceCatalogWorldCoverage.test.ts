import { describe, expect, it } from "vitest";
import { resolveWorldCatalogCoverage } from "./sourceCatalogWorldCoverage";

const catalog = [
  { id: "mistborn-final-empire", title: "El Imperio Final", sourceCollectionId: "cosmere.epub", access: "verified-structure" as const },
  { id: "elantris", title: "Elantris", sourceCollectionId: "cosmere.epub", access: "verified-structure" as const },
  { id: "warbreaker", title: "El aliento de los dioses", sourceCollectionId: "cosmere.epub", access: "verified-structure" as const },
];

describe("world catalog coverage", () => {
  const assignments = [
    { catalogEntryId: "mistborn-final-empire", worldId: "scadrial" },
    { catalogEntryId: "elantris", worldId: "sel" },
    { catalogEntryId: "warbreaker", worldId: "nalthis" },
  ];

  it("reports complete coverage from explicit assignments", () => {
    expect(resolveWorldCatalogCoverage(catalog, assignments, {
      expectedWorldIds: ["scadrial", "sel", "nalthis"],
    })).toEqual({
      status: "complete",
      coveredWorldIds: ["scadrial", "sel", "nalthis"],
      missingWorldIds: [],
    });
  });

  it("reports missing worlds without inferring membership", () => {
    const result = resolveWorldCatalogCoverage(catalog, assignments, {
      expectedWorldIds: ["scadrial", "taldain"],
    });
    expect(result).toEqual({
      status: "incomplete",
      coveredWorldIds: ["scadrial"],
      missingWorldIds: ["taldain"],
    });
  });

  it("fails closed for duplicate entry assignments or unknown catalog entries", () => {
    expect(resolveWorldCatalogCoverage(catalog, [
      ...assignments,
      { catalogEntryId: "elantris", worldId: "sel" },
    ], { expectedWorldIds: ["scadrial"] }).status).toBe("blocked");

    expect(resolveWorldCatalogCoverage(catalog, [
      { catalogEntryId: "unknown", worldId: "scadrial" },
    ], { expectedWorldIds: ["scadrial"] }).status).toBe("blocked");
  });

  it("fails closed for duplicate expected worlds", () => {
    expect(resolveWorldCatalogCoverage(catalog, assignments, {
      expectedWorldIds: ["scadrial", "scadrial"],
    }).status).toBe("blocked");
  });
});
