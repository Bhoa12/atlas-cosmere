import { resolveWorldForWork, validateCatalogue } from "./catalogueExpansion";

const sources = [{ id: "source-index", label: "verified", status: "verified-index" as const }];
const worlds = [{ id: "world-a", label: "World A" }];
const works = [{ id: "work-a", title: "Work A", sourceId: "source-index" }];

describe("catalogue expansion boundary", () => {
  it("accepts explicit metadata", () => {
    expect(validateCatalogue(sources, worlds, works, [{
      workId: "work-a", worldId: "world-a", sourceId: "source-index",
    }])).toEqual([]);
  });

  it("does not infer a world without exactly one explicit relation", () => {
    expect(resolveWorldForWork("work-a", [])).toBeNull();
  });

  it("rejects unknown references", () => {
    expect(validateCatalogue(sources, worlds, works, [{
      workId: "missing", worldId: "world-a", sourceId: "source-index",
    }])).toContain("unknown-work:missing");
  });
});
