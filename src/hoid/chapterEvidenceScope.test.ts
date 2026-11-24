import { describe, expect, it } from "vitest";
import { getHoidReadingManifest } from "./readingManifest";
import { createHoidChapterReference } from "./chapterReference";
import {
  canonicalizeHoidChapterEvidenceScope,
  isHoidEvidenceInChapterScope,
} from "./chapterEvidenceScope";

function reference(chapterNumber: number) {
  const result = createHoidChapterReference("twok", { chapterNumber });
  if (result.status !== "ready") throw new Error("Referencia sintética no disponible");
  return result.reference;
}

function locator(bookId: string, chapterNumber: number): string {
  const result = getHoidReadingManifest(bookId);
  if (result.status !== "ready") throw new Error("Manifiesto sintético no disponible");
  const unit = result.manifest.units.find(candidate => candidate.chapterNumber === chapterNumber);
  if (!unit?.locatorId) throw new Error("Localizador sintético no disponible");
  return unit.locatorId;
}

describe("Hoid chapter evidence scope", () => {
  it("canonicalizes exact chapter references in deterministic edition order", () => {
    const third = reference(3);
    const second = reference(2);
    const result = canonicalizeHoidChapterEvidenceScope(
      [third, second],
      { mode: "single-work", bookIds: ["twok"] },
    );

    expect(result?.map(item => item.ordinal)).toEqual([2, 3]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(result?.every(item => item.authority === "identity-only")).toBe(true);
  });

  it("rejects a stale identity fingerprint", () => {
    const valid = reference(2);
    const stale = { ...valid, identityFingerprint: "0".repeat(64) };
    expect(canonicalizeHoidChapterEvidenceScope(
      [stale],
      { mode: "single-work", bookIds: ["twok"] },
    )).toBeNull();
  });

  it("rejects duplicate chapter identities", () => {
    const valid = reference(2);
    expect(canonicalizeHoidChapterEvidenceScope(
      [valid, valid],
      { mode: "single-work", bookIds: ["twok"] },
    )).toBeNull();
  });

  it("requires at least one exact anchor for every work in a cross-work scope", () => {
    const valid = reference(2);
    expect(canonicalizeHoidChapterEvidenceScope(
      [valid],
      { mode: "cross-work", bookIds: ["edgedancer", "twok"] },
    )).toBeNull();
  });

  it("rejects a structurally forged ambiguous label", () => {
    const valid = reference(2);
    const ambiguous = { ...valid, labelAmbiguous: true };
    expect(canonicalizeHoidChapterEvidenceScope(
      [ambiguous],
      { mode: "single-work", bookIds: ["twok"] },
    )).toBeNull();
  });

  it("matches evidence by its exact edition-bound locator, not by chapter number alone", () => {
    const anchor = reference(2);
    expect(isHoidEvidenceInChapterScope(
      "twok",
      2,
      locator("twok", 2),
      [anchor],
    )).toBe(true);

    // The visible chapter number claims chapter 2, but the locator belongs to
    // chapter 3. The source tuple must fail closed instead of matching by label.
    expect(isHoidEvidenceInChapterScope(
      "twok",
      2,
      locator("twok", 3),
      [anchor],
    )).toBe(false);
  });

  it("rejects a locator from another work even when the numeric chapter matches", () => {
    const anchor = reference(2);
    expect(isHoidEvidenceInChapterScope(
      "edgedancer",
      2,
      locator("twok", 2),
      [anchor],
    )).toBe(false);
  });

  it("rejects stale, forged, and sparse chapter-scope arrays", () => {
    const anchor = reference(2);
    const stale = { ...anchor, identityFingerprint: "0".repeat(64) };
    expect(isHoidEvidenceInChapterScope("twok", 2, locator("twok", 2), [stale])).toBe(false);

    const sparse = new Array(1) as typeof anchor[];
    expect(isHoidEvidenceInChapterScope("twok", 2, locator("twok", 2), sparse)).toBe(false);
  });
});
