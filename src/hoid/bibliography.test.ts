import { HOID_SOURCE_BIBLIOGRAPHY, isKnownHoidSource } from "./bibliography";

describe("HOID_SOURCE_BIBLIOGRAPHY", () => {
  it("keeps source identifiers unique so reading progress cannot authorize the wrong work", () => {
    const ids = HOID_SOURCE_BIBLIOGRAPHY.map(source => source.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("contains only metadata needed to identify supplied source works", () => {
    for (const source of HOID_SOURCE_BIBLIOGRAPHY) {
      expect(source.id.trim()).not.toBe("");
      expect(source.title.trim()).not.toBe("");
      expect(["cosmere.epub", "roshar-epubs"]).toContain(source.sourceGroup);
      expect(Object.keys(source).sort()).toEqual(["id", "sourceGroup", "title"]);
    }
  });

  it("recognizes every catalog source and rejects unknown identifiers", () => {
    for (const source of HOID_SOURCE_BIBLIOGRAPHY) {
      expect(isKnownHoidSource(source.id)).toBe(true);
    }
    expect(isKnownHoidSource("unknown-source")).toBe(false);
  });
});
