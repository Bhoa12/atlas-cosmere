import { describe, expect, it } from "vitest";
import {
  getVerifiedChapterLocatorCount,
  getVerifiedChapterLocatorId,
} from "./verifiedChapterLocators";

describe("verified EPUB chapter locators", () => {
  it("covers only chapter units extracted from the three accessible Roshar source editions", () => {
    expect(getVerifiedChapterLocatorCount("twok")).toBe(75);
    expect(getVerifiedChapterLocatorCount("wor")).toBe(89);
    expect(getVerifiedChapterLocatorCount("ob")).toBe(122);
    expect(getVerifiedChapterLocatorCount("row")).toBe(117);
    expect(getVerifiedChapterLocatorCount("sawt")).toBe(11);
    expect(getVerifiedChapterLocatorCount("edgedancer")).toBe(20);
    expect(getVerifiedChapterLocatorCount("dawnshard")).toBe(19);
  });

  it("returns stable locators bound to the exact edition and navigation digest", () => {
    const locator = getVerifiedChapterLocatorId(
      "twok",
      "roshar-omnibus-v1",
      "08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025",
      1,
    );
    expect(locator).toBe(
      "nav:roshar-omnibus-v1:08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025:L1-012.xhtml",
    );
  });

  it("rejects another edition or navigation digest", () => {
    expect(getVerifiedChapterLocatorId(
      "twok",
      "another-edition",
      "08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025",
      1,
    )).toBeNull();
    expect(getVerifiedChapterLocatorId(
      "twok",
      "roshar-omnibus-v1",
      "0".repeat(64),
      1,
    )).toBeNull();
  });

  it("does not expose duplicated Viento y verdad chapters beyond its verified numeric prefix", () => {
    expect(getVerifiedChapterLocatorId(
      "sawt",
      "roshar-omnibus-v1",
      "08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025",
      11,
    )).not.toBeNull();
    expect(getVerifiedChapterLocatorId(
      "sawt",
      "roshar-omnibus-v1",
      "08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025",
      12,
    )).toBeNull();
  });

  it("exposes inspected numeric Cosmere locators and keeps merged collections blocked", () => {
    expect(getVerifiedChapterLocatorCount("tfe")).toBe(38);
    expect(getVerifiedChapterLocatorId(
      "tfe",
      "cosmere-epub-merged-v1",
      "85c53b4a8a24bffdd1c2cbba99bcd5da47d47b78589d784047e0fcb9cfab7aee",
      1,
    )).toBe(
      "nav:cosmere-epub-merged-v1:85c53b4a8a24bffdd1c2cbba99bcd5da47d47b78589d784047e0fcb9cfab7aee:books/b000001/OEBPS/Text/001.xhtml",
    );
    expect(getVerifiedChapterLocatorCount("white-sand-1")).toBe(0);
    expect(getVerifiedChapterLocatorCount("white-sand-2")).toBe(0);
    expect(getVerifiedChapterLocatorCount("white-sand-3")).toBe(0);
    expect(getVerifiedChapterLocatorCount("arcanum")).toBe(0);
  });

  it("rejects unknown works and invalid chapter numbers", () => {
    expect(getVerifiedChapterLocatorId("unknown", "x", "x", 1)).toBeNull();
    expect(getVerifiedChapterLocatorId("twok", "roshar-omnibus-v1", "08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025", 0)).toBeNull();
    expect(getVerifiedChapterLocatorId("twok", "roshar-omnibus-v1", "08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025", 76)).toBeNull();
  });
});
