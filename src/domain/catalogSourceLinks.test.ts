import { describe, expect, it } from "vitest";
import { validateCatalogSourceLinks } from "./catalogSourceLinks";

const worlds = [{
  id: "scadrial",
  name: "Scadrial",
  works: [{
    id: "work-1",
    worldId: "scadrial",
    title: "Declared work",
    sequence: 1,
    format: "novel" as const,
    units: [],
  }],
}];

describe("validateCatalogSourceLinks", () => {
  it("accepts a unique link to a declared source", () => {
    expect(validateCatalogSourceLinks(
      worlds,
      [{ workId: "work-1", sourceId: "source-1" }],
      [{ sourceId: "source-1", title: "Source", availability: "declared" }],
    )).toEqual([]);
  });

  it("fails closed for unknown works, duplicate links and missing sources", () => {
    expect(validateCatalogSourceLinks(
      worlds,
      [
        { workId: "missing-work", sourceId: "source-1" },
        { workId: "work-1", sourceId: "missing-source" },
        { workId: "work-1", sourceId: "source-1" },
      ],
      [{ sourceId: "source-1", title: "Source", availability: "declared" }],
    ).map((issue) => issue.code)).toEqual([
      "unknown_work",
      "unknown_source",
      "duplicate_work_link",
    ]);
  });

  it("rejects links to an ambiguous source manifest entry", () => {
    expect(validateCatalogSourceLinks(
      worlds,
      [{ workId: "work-1", sourceId: "source-1" }],
      [
        { sourceId: "source-1", title: "A", availability: "declared" },
        { sourceId: "source-1", title: "B", availability: "declared" },
      ],
    )[0]?.code).toBe("ambiguous_source");
  });
});
