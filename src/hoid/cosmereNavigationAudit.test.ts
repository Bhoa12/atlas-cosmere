import { describe, expect, it } from "vitest";
import { getHoidReadingManifest } from "./readingManifest";
import { getVerifiedChapterDocumentCount } from "./verifiedChapterDocuments";
import { getVerifiedChapterLocatorCount } from "./verifiedChapterLocators";

const EXPECTED_COSMERE_LOCATORS = [
  ["tfe", 38],
  ["woa", 59],
  ["hoa", 82],
  ["aol", 20],
  ["sos", 26],
  ["bom", 31],
  ["tlm", 74],
  ["warbreaker", 58],
  ["elantris", 47],
  ["tress", 64],
  ["yumi", 41],
  ["sunlit", 52],
  ["isles", 61],
] as const;

describe("cosmere.epub navigation audit", () => {
  it("exposes 653 verified numbered chapter locators across 13 catalogue works", () => {
    const total = EXPECTED_COSMERE_LOCATORS.reduce((sum, [, count]) => sum + count, 0);
    expect(total).toBe(653);
    for (const [bookId, count] of EXPECTED_COSMERE_LOCATORS) {
      expect(getVerifiedChapterLocatorCount(bookId)).toBe(count);
    }
  });

  it("builds complete edition-bound manifests for every unambiguous numeric work", () => {
    for (const [bookId, count] of EXPECTED_COSMERE_LOCATORS) {
      const result = getHoidReadingManifest(bookId);
      expect(result.status, bookId).toBe("ready");
      if (result.status !== "ready") continue;
      expect(result.manifest.editionId).toBe("cosmere-epub-merged-v1");
      expect(result.manifest.navigationSha256).toBe(
        "85c53b4a8a24bffdd1c2cbba99bcd5da47d47b78589d784047e0fcb9cfab7aee",
      );
      expect(result.manifest.units).toHaveLength(count);
      expect(result.manifest.units.every(unit =>
        typeof unit.locatorId === "string" &&
        unit.locatorId.includes("/OEBPS/Text/") &&
        !unit.locatorId.includes(".."),
      )).toBe(true);
    }
  });

  it("caps Elantris before the first duplicated chapter number", () => {
    const result = getHoidReadingManifest("elantris");
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.manifest.coverage).toBe("partial-before-ambiguous-chapter");
    expect(result.manifest.units.map(unit => unit.chapterNumber)).toEqual(
      Array.from({ length: 47 }, (_, index) => index + 1),
    );
    expect(result.manifest.ambiguousChapterNumbers).toEqual([48, 51, 57]);
  });

  it("keeps White Sand volumes and Arcanum collection unavailable for numeric progress", () => {
    for (const bookId of ["white-sand-1", "white-sand-2", "white-sand-3", "arcanum"]) {
      const result = getHoidReadingManifest(bookId);
      expect(result.status).toBe("unavailable");
      if (result.status === "unavailable") {
        expect(result.reason).toBe("segmentation-unverified");
      }
      expect(getVerifiedChapterLocatorCount(bookId)).toBe(0);
    }
  });

  it("keeps TOC locators distinct from sparse chapter-body evidence", () => {
    for (const [bookId] of EXPECTED_COSMERE_LOCATORS) {
      expect(getVerifiedChapterDocumentCount(bookId)).toBe(bookId === "tfe" ? 11 : 0);
    }
    expect(getVerifiedChapterDocumentCount("tfe")).toBe(11);
    expect(getVerifiedChapterDocumentCount("twok")).toBe(21);
    expect(getVerifiedChapterDocumentCount("edgedancer")).toBe(20);
    expect(getVerifiedChapterDocumentCount("dawnshard")).toBe(19);
    for (const bookId of ["wor", "ob", "row", "sawt"]) {
      expect(getVerifiedChapterDocumentCount(bookId)).toBe(0);
    }
  });

  it("preserves the existing Roshar locator inventory", () => {
    expect(
      ["twok", "wor", "ob", "row", "sawt", "edgedancer", "dawnshard"]
        .reduce((sum, bookId) => sum + getVerifiedChapterLocatorCount(bookId), 0),
    ).toBe(453);
  });
});
