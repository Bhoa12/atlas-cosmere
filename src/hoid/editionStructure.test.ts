import { describe, expect, it } from "vitest";
import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import {
  getHoidEditionProgressPolicy,
  HOID_EDITION_STRUCTURES,
  validateHoidEditionStructures,
} from "./editionStructure";

describe("Hoid edition structure", () => {
  it("covers every supplied bibliography work exactly once", () => {
    const assigned = HOID_EDITION_STRUCTURES.flatMap(source =>
      source.works.flatMap(work => [...work.workIds]),
    );

    expect(assigned).toHaveLength(HOID_SOURCE_BIBLIOGRAPHY.length);
    expect(new Set(assigned).size).toBe(HOID_SOURCE_BIBLIOGRAPHY.length);
    expect(new Set(assigned)).toEqual(new Set(HOID_SOURCE_BIBLIOGRAPHY.map(work => work.id)));
  });

  it("records chapter counts only for contiguous numeric chapter models", () => {
    expect(getHoidEditionProgressPolicy("tfe")).toMatchObject({
      kind: "numeric-chapters",
      chapterCount: 38,
    });
    expect(getHoidEditionProgressPolicy("twok")).toMatchObject({
      kind: "numeric-chapters",
      chapterCount: 75,
    });
    expect(getHoidEditionProgressPolicy("edgedancer")).toMatchObject({
      kind: "numeric-chapters",
      chapterCount: 20,
    });
    expect(getHoidEditionProgressPolicy("dawnshard")).toMatchObject({
      kind: "numeric-chapters",
      chapterCount: 19,
    });
  });

  it("caps numeric progress before duplicated chapter locators", () => {
    expect(getHoidEditionProgressPolicy("elantris")).toMatchObject({
      kind: "chapter-number-with-duplicate-locators",
      chapterCount: 63,
      safeNumericProgressThroughChapter: 47,
      duplicateChapterNumbers: [48, 51, 57],
    });
    expect(getHoidEditionProgressPolicy("sawt")).toMatchObject({
      kind: "chapter-number-with-duplicate-locators",
      chapterCount: 147,
      safeNumericProgressThroughChapter: 11,
      duplicateChapterNumbers: [12, 14],
    });
  });

  it("does not invent per-volume chapter counts for the merged White Sand navigation", () => {
    for (const id of ["white-sand-1", "white-sand-2", "white-sand-3"]) {
      expect(getHoidEditionProgressPolicy(id).kind).toBe("requires-volume-segmentation");
    }
  });

  it("does not invent a global chapter count for a multi-work collection", () => {
    expect(getHoidEditionProgressPolicy("arcanum")).toMatchObject({
      kind: "collection-sections",
    });
  });

  it("returns unknown for works outside the supplied bibliography", () => {
    expect(getHoidEditionProgressPolicy("unverified-work")).toEqual({ kind: "unknown" });
    expect(getHoidEditionProgressPolicy("")).toEqual({ kind: "unknown" });
  });

  it("rejects incomplete bibliography coverage", () => {
    expect(() => validateHoidEditionStructures(HOID_EDITION_STRUCTURES.slice(1))).toThrow();
  });

  it("rejects an ambiguous numeric structure without duplicate-locator metadata", () => {
    const source = HOID_EDITION_STRUCTURES[0];
    const invalid = [{
      ...source,
      works: source.works.map((work, index) => index === 8
        ? { workIds: ["elantris"], mode: "numeric-chapters" as const, chapterCount: 63 }
        : work),
    }, ...HOID_EDITION_STRUCTURES.slice(1)];

    expect(() => validateHoidEditionStructures(invalid)).toThrow();
  });

  it("stores only navigation digests and progress metadata, not EPUB locators or chapter titles", () => {
    const serialized = JSON.stringify(HOID_EDITION_STRUCTURES);
    expect(serialized).not.toMatch(/\.xhtml|\.ncx|Capítulo\s+\d|Prólogo|Epílogo/i);
    expect(HOID_EDITION_STRUCTURES.every(source => /^[a-f0-9]{64}$/.test(source.navigationSha256))).toBe(true);
  });
});
