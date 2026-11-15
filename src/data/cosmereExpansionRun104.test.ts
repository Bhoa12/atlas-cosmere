import { auditManifest, visibleCards, type ExpansionManifest } from "./cosmereExpansionRun104";

const base: ExpansionManifest = {
  sources: [{ id: "catalog", kind: "verified-index", accessible: true }, { id: "editorial", kind: "editorial-accessible", accessible: true }],
  works: [{ id: "work", title: "Obra de prueba", sourceId: "catalog" }],
  worlds: [{ id: "world", name: "Mundo de prueba" }],
  links: [{ workId: "work", worldId: "world", sourceId: "catalog" }],
  units: [{ id: "u1", workId: "work", position: 1, sourceId: "editorial" }],
  cards: [{ id: "c1", workId: "work", sourceId: "editorial", requiresUnitIds: ["u1"], summary: "Resumen original de prueba." }]
};

describe("cosmere expansion run104", () => {
  it("keeps a valid manifest clean", () => expect(auditManifest(base)).toEqual([]));
  it("fails closed until all requirements are complete", () => {
    expect(visibleCards(base, { workId: "work", completedUnitIds: [] })).toEqual([]);
    expect(visibleCards(base, { workId: "work", completedUnitIds: ["u1"] }).map(x => x.id)).toEqual(["c1"]);
  });
  it("rejects private sources for reading units", () => {
    const manifest = { ...base, sources: [{ id: "private", kind: "declared-private" as const, accessible: false }] };
    expect(auditManifest(manifest)).toContain("unknown-work-source:work");
  });
});