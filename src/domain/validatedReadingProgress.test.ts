import { resolveValidatedReadingProgress } from "./validatedReadingProgress";

describe("resolveValidatedReadingProgress", () => {
  const manifest = [
    { worldId: "scadrial", unitId: "s-1", sourceCatalogEntryId: "work-a", order: 1 },
    { worldId: "scadrial", unitId: "s-2", sourceCatalogEntryId: "work-a", order: 2 },
    { worldId: "sel", unitId: "e-1", sourceCatalogEntryId: "work-b", order: 1 },
  ];

  it("keeps completion explicit and preserves manifest order", () => {
    expect(resolveValidatedReadingProgress(manifest, true, [
      { unitId: "e-1", completed: true },
      { unitId: "s-1", completed: true },
    ])).toEqual({ status: "valid", completedUnitIds: ["s-1", "e-1"], pendingUnitIds: ["s-2"] });
  });

  it("does not infer completion for omitted units", () => {
    expect(resolveValidatedReadingProgress(manifest, true, [])).toEqual({
      status: "valid", completedUnitIds: [], pendingUnitIds: ["s-1", "s-2", "e-1"],
    });
  });

  it("fails closed for unknown or duplicate progress", () => {
    expect(resolveValidatedReadingProgress(manifest, true, [{ unitId: "unknown", completed: true }]).status).toBe("blocked");
    expect(resolveValidatedReadingProgress(manifest, true, [
      { unitId: "s-1", completed: true }, { unitId: "s-1", completed: false },
    ]).status).toBe("blocked");
  });

  it("fails closed when manifest validation is unavailable", () => {
    expect(resolveValidatedReadingProgress(manifest, false, [{ unitId: "s-1", completed: true }]).status).toBe("blocked");
  });
});
