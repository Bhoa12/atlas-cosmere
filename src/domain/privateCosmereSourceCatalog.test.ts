import { describe, expect, it } from "vitest";
import {
  privateCosmereSourceCatalog,
  validateBibliographicSourceManifest,
} from "./privateCosmereSourceCatalog";

describe("privateCosmereSourceCatalog", () => {
  it("contains only declared sources and no editorial payload", () => {
    expect(privateCosmereSourceCatalog).toHaveLength(17);
    expect(privateCosmereSourceCatalog.every((source) => source.availability === "declared")).toBe(true);
    expect(validateBibliographicSourceManifest(privateCosmereSourceCatalog)).toEqual([]);
  });

  it("reports structural duplicates without inventing a resolution", () => {
    expect(validateBibliographicSourceManifest([
      { sourceId: "x", title: "A", availability: "declared" },
      { sourceId: "x", title: "A", availability: "declared" },
    ])).toEqual(["Duplicate source id: x", "Duplicate source title: A"]);
  });
});
