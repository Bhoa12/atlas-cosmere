import { describe, expect, it } from "vitest";
import { resolveReadingUnitManifest } from "./readingUnitManifest";

describe("resolveReadingUnitManifest", () => {
  const activation = [
    { worldId: "scadrial", readingReady: true, reason: "activated" as const },
    { worldId: "sel", readingReady: false, reason: "missing-coverage" as const },
  ];

  it("accepts and orders metadata-only units for activated worlds", () => {
    const result = resolveReadingUnitManifest(activation, true, [
      { worldId: "scadrial", unitId: "scadrial-2", sourceCatalogEntryId: "work-b", order: 2 },
      { worldId: "scadrial", unitId: "scadrial-1", sourceCatalogEntryId: "work-a", order: 1 },
    ]);
    expect(result.status).toBe("valid");
    expect(result.entries.map((entry) => entry.unitId)).toEqual(["scadrial-1", "scadrial-2"]);
  });

  it("blocks units for worlds that are not activated", () => {
    const result = resolveReadingUnitManifest(activation, true, [
      { worldId: "sel", unitId: "sel-1", sourceCatalogEntryId: "work-a", order: 1 },
    ]);
    expect(result).toEqual({ status: "blocked", entries: [], invalidWorldIds: ["sel"] });
  });

  it("fails closed when activation integrity is unavailable", () => {
    expect(resolveReadingUnitManifest(activation, false, [
      { worldId: "scadrial", unitId: "scadrial-1", sourceCatalogEntryId: "work-a", order: 1 },
    ]).status).toBe("blocked");
  });

  it("rejects duplicate unit ids and duplicate world order", () => {
    expect(resolveReadingUnitManifest(activation, true, [
      { worldId: "scadrial", unitId: "same", sourceCatalogEntryId: "work-a", order: 1 },
      { worldId: "scadrial", unitId: "same", sourceCatalogEntryId: "work-b", order: 2 },
    ]).status).toBe("blocked");
    expect(resolveReadingUnitManifest(activation, true, [
      { worldId: "scadrial", unitId: "one", sourceCatalogEntryId: "work-a", order: 1 },
      { worldId: "scadrial", unitId: "two", sourceCatalogEntryId: "work-b", order: 1 },
    ]).status).toBe("blocked");
  });

  it("fails closed for malformed runtime collections and scalar metadata", () => {
    const malformedActivation = [{ worldId: 7, readingReady: true, reason: "activated" }] as any;
    const malformedEntries = [{ worldId: "scadrial", unitId: "unit", sourceCatalogEntryId: "work", order: Number.MAX_SAFE_INTEGER + 1 }] as any;
    expect(resolveReadingUnitManifest(malformedActivation, true, [] as any).status).toBe("blocked");
    expect(resolveReadingUnitManifest(activation, true, malformedEntries).status).toBe("blocked");
    expect(resolveReadingUnitManifest(activation, true, { entries: [] } as any).status).toBe("blocked");
  });

  it("rejects non-canonical identifiers instead of silently normalizing them", () => {
    expect(resolveReadingUnitManifest(activation, true, [
      { worldId: " scadrial ", unitId: "unit-1", sourceCatalogEntryId: "work-a", order: 1 },
    ]).status).toBe("blocked");
  });
});
