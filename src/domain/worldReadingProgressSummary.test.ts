import { resolveWorldReadingProgressSummary } from "./worldReadingProgressSummary";

describe("resolveWorldReadingProgressSummary", () => {
  const manifest = [
    { worldId: "scadrial", unitId: "s-1", sourceCatalogEntryId: "work-a", order: 1 },
    { worldId: "scadrial", unitId: "s-2", sourceCatalogEntryId: "work-a", order: 2 },
    { worldId: "sel", unitId: "e-1", sourceCatalogEntryId: "work-b", order: 1 },
  ];

  it("summarizes worlds from explicit validated progress", () => {
    expect(resolveWorldReadingProgressSummary(manifest, true, {
      status: "valid", completedUnitIds: ["s-1", "e-1"], pendingUnitIds: ["s-2"],
    })).toEqual({
      status: "valid",
      worlds: [
        { worldId: "scadrial", totalUnits: 2, completedUnits: 1, pendingUnits: 1, completionRatio: 0.5 },
        { worldId: "sel", totalUnits: 1, completedUnits: 1, pendingUnits: 0, completionRatio: 1 },
      ],
    });
  });

  it("fails closed when validated progress does not partition the manifest", () => {
    expect(resolveWorldReadingProgressSummary(manifest, true, {
      status: "valid", completedUnitIds: ["s-1"], pendingUnitIds: ["s-2"],
    }).status).toBe("blocked");
  });

  it("fails closed when manifest or progress validation is unavailable", () => {
    expect(resolveWorldReadingProgressSummary(manifest, false, {
      status: "valid", completedUnitIds: [], pendingUnitIds: ["s-1", "s-2", "e-1"],
    }).status).toBe("blocked");
    expect(resolveWorldReadingProgressSummary(manifest, true, {
      status: "blocked", completedUnitIds: [], pendingUnitIds: [],
    }).status).toBe("blocked");
  });

  it("fails closed on malformed manifest collections or entries at runtime", () => {
    expect(resolveWorldReadingProgressSummary({ bad: true } as any, true, {
      status: "valid", completedUnitIds: [], pendingUnitIds: [],
    }).status).toBe("blocked");

    expect(resolveWorldReadingProgressSummary([
      { worldId: "scadrial", unitId: " s-1", sourceCatalogEntryId: "work-a", order: 1 },
    ] as any, true, {
      status: "valid", completedUnitIds: ["s-1"], pendingUnitIds: [],
    }).status).toBe("blocked");
  });
});
