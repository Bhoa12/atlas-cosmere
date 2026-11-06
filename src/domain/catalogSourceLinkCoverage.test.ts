import { describe, expect, it } from "vitest";
import type { WorldCatalogEntry } from "./cosmereCatalog";
import { summarizeCatalogSourceLinkCoverage } from "./catalogSourceLinkCoverage";

const worlds: WorldCatalogEntry[] = [{
  id: "scadrial",
  name: "Scadrial",
  works: [
    { id: "mistborn-1", worldId: "scadrial", title: "Declared work", sequence: 1, format: "novel", units: [] },
    { id: "mistborn-2", worldId: "scadrial", title: "Another work", sequence: 2, format: "novel", units: [] },
  ],
}];

describe("summarizeCatalogSourceLinkCoverage", () => {
  it("counts only uniquely declared sources as provenance coverage", () => {
    const summary = summarizeCatalogSourceLinkCoverage(
      worlds,
      [
        { workId: "mistborn-1", sourceId: "source-1" },
        { workId: "mistborn-2", sourceId: "missing" },
      ],
      [{ sourceId: "source-1", title: "Source", availability: "declared" }],
    );

    expect(summary.linkedWorkIds).toEqual(["mistborn-1"]);
    expect(summary.unlinkedWorkIds).toEqual(["mistborn-2"]);
    expect(summary.missingSourceIds).toEqual(["missing"]);
  });

  it("fails closed for ambiguous sources and unknown works", () => {
    const summary = summarizeCatalogSourceLinkCoverage(
      worlds,
      [
        { workId: "mistborn-1", sourceId: "duplicate" },
        { workId: "unknown-work", sourceId: "source-1" },
      ],
      [
        { sourceId: "duplicate", title: "One", availability: "declared" },
        { sourceId: "duplicate", title: "Two", availability: "declared" },
      ],
    );

    expect(summary.linkedWorkIds).toEqual([]);
    expect(summary.unlinkedWorkIds).toEqual(["mistborn-1", "mistborn-2"]);
    expect(summary.ambiguousSourceIds).toEqual(["duplicate"]);
  });
});
