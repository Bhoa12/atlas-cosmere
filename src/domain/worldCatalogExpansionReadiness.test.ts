import { describe, expect, it } from "vitest";
import { resolveWorldCatalogExpansionReadiness } from "./worldCatalogExpansionReadiness";

const catalog = [
  { id: "mistborn-final-empire", title: "El Imperio Final", sourceCollectionId: "cosmere.epub", access: "verified-structure" as const },
  { id: "elantris", title: "Elantris", sourceCollectionId: "cosmere.epub", access: "verified-structure" as const },
];

describe("world catalog expansion readiness", () => {
  it("marks explicitly covered worlds ready and leaves missing worlds cataloged", () => {
    expect(resolveWorldCatalogExpansionReadiness(catalog, [
      { catalogEntryId: "mistborn-final-empire", worldId: "scadrial" },
      { catalogEntryId: "elantris", worldId: "sel" },
    ], { expectedWorldIds: ["scadrial", "sel", "taldain"] })).toEqual([
      { worldId: "scadrial", status: "ready" },
      { worldId: "sel", status: "ready" },
      { worldId: "taldain", status: "cataloged" },
    ]);
  });

  it("fails closed for malformed coverage metadata", () => {
    expect(resolveWorldCatalogExpansionReadiness(catalog, [
      { catalogEntryId: "unknown", worldId: "scadrial" },
    ], { expectedWorldIds: ["scadrial", "sel"] })).toEqual([
      { worldId: "scadrial", status: "blocked" },
      { worldId: "sel", status: "blocked" },
    ]);
  });
});
