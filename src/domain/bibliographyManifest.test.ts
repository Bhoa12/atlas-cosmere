import { describe, expect, it } from "vitest";
import { COSMERE_EPUB_BIBLIOGRAPHY } from "./cosmereBibliographyCatalog";
import { resolveBibliographyManifest } from "./bibliographyManifest";

describe("bibliography manifest", () => {
  const catalog = COSMERE_EPUB_BIBLIOGRAPHY.slice(0, 2);
  const bindings = [
    { sourceId: catalog[0].id, workId: "work-a" },
    { sourceId: catalog[1].id, workId: "work-b" },
  ];

  it("reports complete coverage from explicit provenance", () => {
    expect(resolveBibliographyManifest(catalog, bindings, ["work-a", "work-b"]))
      .toEqual({ status: "complete", uncoveredWorkIds: [] });
  });

  it("reports declared works that lack explicit coverage", () => {
    expect(resolveBibliographyManifest(catalog, bindings.slice(0, 1), ["work-a", "work-b"]))
      .toEqual({ status: "incomplete", uncoveredWorkIds: ["work-b"] });
  });

  it("fails closed when a binding references a source outside the catalog", () => {
    expect(resolveBibliographyManifest(
      catalog,
      [{ sourceId: "unknown-source", workId: "work-a" }],
      ["work-a"],
    )).toEqual({ status: "blocked", uncoveredWorkIds: [] });
  });

  it("fails closed for duplicate or empty declared work identifiers", () => {
    expect(resolveBibliographyManifest(catalog, bindings, ["work-a", "work-a"]).status)
      .toBe("blocked");
    expect(resolveBibliographyManifest(catalog, bindings, []).status)
      .toBe("blocked");
  });
});
