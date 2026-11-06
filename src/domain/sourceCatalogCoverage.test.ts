import { describe, expect, it } from "vitest";
import { privateCosmereSourceCatalog } from "./privateCosmereSourceCatalog";
import { summarizeSourceCatalogCoverage } from "./sourceCatalogCoverage";

describe("summarizeSourceCatalogCoverage", () => {
  it("reports complete coverage without upgrading source evidence", () => {
    const expected = privateCosmereSourceCatalog.map((source) => source.sourceId);
    const summary = summarizeSourceCatalogCoverage(privateCosmereSourceCatalog, expected);

    expect(summary.declaredCount).toBe(17);
    expect(summary.missingExpectedSourceIds).toEqual([]);
    expect(summary.unexpectedDeclaredSourceIds).toEqual([]);
  });

  it("reports missing and unexpected identifiers explicitly", () => {
    const summary = summarizeSourceCatalogCoverage(
      [{ sourceId: "known", title: "Known", availability: "declared" }],
      ["known", "missing"],
    );

    expect(summary.missingExpectedSourceIds).toEqual(["missing"]);
    expect(summary.unexpectedDeclaredSourceIds).toEqual([]);
  });
});
