import { auditWorkWorldLinks, priorityWorlds } from "./cosmereExpansionRun95";

describe("safe catalog-to-domain links", () => {
  const sources = [{ id: "catalog", kind: "verified-index" as const, accessible: true }];
  const works = [{ id: "work-1", title: "Catálogo", sourceId: "catalog" }];

  it("accepts explicit links without inferring any missing relationship", () => {
    const audit = auditWorkWorldLinks(sources, priorityWorlds, works, [
      { workId: "work-1", worldId: "scadrial", sourceId: "catalog" },
    ]);
    expect(audit.errors).toEqual([]);
    expect(audit.validLinks).toHaveLength(1);
  });

  it("rejects unknown worlds and works", () => {
    const audit = auditWorkWorldLinks(sources, priorityWorlds, works, [
      { workId: "missing", worldId: "scadrial", sourceId: "catalog" },
      { workId: "work-1", worldId: "missing", sourceId: "catalog" },
    ]);
    expect(audit.validLinks).toEqual([]);
    expect(audit.errors).toContain("unknown-work:missing");
    expect(audit.errors).toContain("unknown-world:missing");
  });

  it("does not silently merge duplicate links", () => {
    const link = { workId: "work-1", worldId: "sel", sourceId: "catalog" };
    const audit = auditWorkWorldLinks(sources, priorityWorlds, works, [link, link]);
    expect(audit.validLinks).toHaveLength(1);
    expect(audit.errors).toContain("duplicate-link:work-1:sel");
  });
});
