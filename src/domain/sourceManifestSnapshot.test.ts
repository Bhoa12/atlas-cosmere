import { describe, expect, it } from "vitest";
import { privateCosmereSourceCatalog } from "./privateCosmereSourceCatalog";
import { resolveSourceManifestSnapshot } from "./sourceManifestSnapshot";

describe("resolveSourceManifestSnapshot", () => {
  it("reports a valid bibliography as declared without upgrading evidence", () => {
    expect(resolveSourceManifestSnapshot(privateCosmereSourceCatalog)).toEqual({
      status: "declared",
      sourceCount: 17,
    });
  });

  it("fails closed for an empty or malformed manifest", () => {
    expect(resolveSourceManifestSnapshot([])).toEqual({ status: "blocked", sourceCount: 0 });
    expect(resolveSourceManifestSnapshot([
      { sourceId: "x", title: "A", availability: "declared" },
      { sourceId: "x", title: "A", availability: "declared" },
    ])).toEqual({ status: "blocked", sourceCount: 0 });
  });
});
