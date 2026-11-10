import { resolveSpoilerVisibility } from "./spoilerVisibility";

describe("resolveSpoilerVisibility", () => {
  const manifest = [
    { worldId: "scadrial", unitId: "s-1", sourceCatalogEntryId: "work-a", order: 1 },
    { worldId: "scadrial", unitId: "s-2", sourceCatalogEntryId: "work-a", order: 2 },
  ];

  it("requires every explicit dependency before content is visible", () => {
    expect(resolveSpoilerVisibility(manifest, true, ["s-1"], [
      { contentId: "safe-note", requiredUnitIds: [] },
      { contentId: "later-note", requiredUnitIds: ["s-1", "s-2"] },
    ])).toEqual([
      { contentId: "safe-note", visibility: "visible" },
      { contentId: "later-note", visibility: "blocked" },
    ]);
  });

  it("fails closed when progress or requirements reference unknown metadata", () => {
    expect(resolveSpoilerVisibility(manifest, true, ["unknown"], [
      { contentId: "note", requiredUnitIds: [] },
    ])).toEqual([{ contentId: "note", visibility: "blocked" }]);

    expect(resolveSpoilerVisibility(manifest, true, [], [
      { contentId: "note", requiredUnitIds: ["unknown"] },
    ])).toEqual([{ contentId: "note", visibility: "blocked" }]);
  });

  it("blocks all declared content when manifest validation is unavailable", () => {
    expect(resolveSpoilerVisibility(manifest, false, [], [
      { contentId: "note", requiredUnitIds: [] },
    ])).toEqual([{ contentId: "note", visibility: "blocked" }]);
  });
});
