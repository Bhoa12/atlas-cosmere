import { auditExpansionManifest, visibleDescriptors } from "./cosmereExpansionRun92";

const editorial = { id: "editorial", kind: "editorial-accessible" as const, accessible: true };
const index = { id: "index", kind: "verified-index" as const, accessible: true };
const privateSource = { id: "private", kind: "declared-private" as const, accessible: false };
const base = {
  sources: [editorial, index, privateSource],
  worlds: [{ id: "scadrial", name: "Scadrial" }, { id: "sel", name: "Sel" }],
  works: [{ id: "w1", title: "Catalog title", sourceId: "index" }],
  worldLinks: [{ workId: "w1", worldId: "scadrial", sourceId: "index" }],
  units: [
    { id: "u1", workId: "w1", position: 1, sourceId: "editorial" },
    { id: "u2", workId: "w1", position: 2, sourceId: "editorial" },
  ],
  gates: [{ id: "g1", workId: "w1", requiredUnitIds: ["u1", "u2"] }],
};

describe("cosmere expansion run92", () => {
  it("keeps world links explicit and validates their references", () => {
    const issues = auditExpansionManifest({ ...base, worldLinks: [{ workId: "missing", worldId: "sel", sourceId: "index" }], descriptors: [] });
    expect(issues.map((issue) => issue.code)).toContain("invalid-world-link");
  });

  it("allows catalog metadata but rejects summaries without accessible editorial support", () => {
    const descriptors = [
      { id: "metadata", workId: "w1", kind: "metadata" as const, sourceId: "index" },
      { id: "summary", workId: "w1", kind: "original-summary" as const, sourceId: "private" },
    ];
    const issues = auditExpansionManifest({ ...base, descriptors });
    expect(issues).toContainEqual({ code: "invalid-descriptor-source", entityId: "summary" });
    expect(issues.some((issue) => issue.entityId === "metadata")).toBe(false);
  });

  it("keeps gated content hidden until every validated requirement is complete", () => {
    const descriptors = [
      { id: "open", workId: "w1", kind: "metadata" as const, sourceId: "index" },
      { id: "gated", workId: "w1", kind: "metadata" as const, sourceId: "index", spoilerGateId: "g1" },
    ];
    const manifest = { ...base, descriptors };
    expect(visibleDescriptors(manifest, { workId: "w1", completedUnitIds: ["u1"] }).map((item) => item.id)).toEqual(["open"]);
    expect(visibleDescriptors(manifest, { workId: "w1", completedUnitIds: ["u2", "u1"] }).map((item) => item.id)).toEqual(["open", "gated"]);
  });
});
