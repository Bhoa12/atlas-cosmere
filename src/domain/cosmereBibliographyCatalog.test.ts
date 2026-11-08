import { describe, expect, it } from "vitest";
import {
  COSMERE_EPUB_BIBLIOGRAPHY,
  resolveBibliographyCatalog,
} from "./cosmereBibliographyCatalog";

describe("Cosmere private bibliography catalog", () => {
  it("exposes the explicitly declared cosmere.epub index as metadata", () => {
    const result = resolveBibliographyCatalog();
    expect(result.status).toBe("valid");
    expect(result.sources).toHaveLength(17);
    expect(result.sources.every((source) => source.sourceCollectionId === "cosmere.epub")).toBe(true);
  });

  it("preserves catalog membership without narrative payload", () => {
    const source = COSMERE_EPUB_BIBLIOGRAPHY.find((entry) => entry.id === "elantris");
    expect(source).toEqual({
      id: "elantris",
      title: "Elantris",
      sourceCollectionId: "cosmere.epub",
      access: "verified-structure",
    });
  });

  it("fails closed for malformed or duplicate source metadata", () => {
    expect(resolveBibliographyCatalog([]).status).toBe("blocked");
    expect(resolveBibliographyCatalog([
      COSMERE_EPUB_BIBLIOGRAPHY[0],
      COSMERE_EPUB_BIBLIOGRAPHY[0],
    ]).status).toBe("blocked");
  });
});
