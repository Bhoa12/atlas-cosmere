import { describe, expect, it } from "vitest";
import { canonicalEvidenceScope, isEvidenceUnlocked } from "./evidenceScope";
import { getHoidReadingManifest } from "./readingManifest";
import type { HoidKnowledgeEntry } from "./catalog";

function locator(bookId: string, chapter: number): string {
  const result = getHoidReadingManifest(bookId);
  if (result.status !== "ready") throw new Error("Manifest de prueba no disponible");
  const unit = result.manifest.units.find(candidate => candidate.chapterNumber === chapter);
  if (!unit?.locatorId) throw new Error("Localizador de prueba no disponible");
  return unit.locatorId;
}

const entry: HoidKnowledgeEntry = {
  id: "e-scope-test",
  aliases: ["Elemento de prueba"],
  kind: "concept",
  firstSafeAppearance: { bookId: "twok", chapter: 2 },
  evidenceSource: { bookId: "twok", chapter: 2, locatorId: locator("twok", 2) },
  evidenceUnlock: { bookId: "twok", chapter: 4 },
  provenance: "verified",
  summary: "Resumen editorial sintético para pruebas de autorización.",
};

describe("isEvidenceUnlocked public boundary", () => {
  it("unlocks only when the single canonical position reaches the evidence ceiling", () => {
    expect(isEvidenceUnlocked(entry, [{ bookId: "twok", chapter: 3 }])).toBe(false);
    expect(isEvidenceUnlocked(entry, [{ bookId: "twok", chapter: 4 }])).toBe(true);
  });

  it("rejects a same-chapter unlock even when the reader position is completed", () => {
    const sameChapterEntry: HoidKnowledgeEntry = {
      ...entry,
      evidenceUnlock: { bookId: "twok", chapter: 2 },
    };

    expect(canonicalEvidenceScope(
      sameChapterEntry.evidenceSource,
      sameChapterEntry.evidenceUnlock,
    )).toBeNull();
    expect(isEvidenceUnlocked(sameChapterEntry, [{ bookId: "twok", chapter: 2 }])).toBe(false);
    expect(isEvidenceUnlocked(sameChapterEntry, [{ bookId: "twok", completed: true }])).toBe(false);
  });

  it("rejects duplicate positions instead of depending on their order", () => {
    expect(isEvidenceUnlocked(entry, [
      { bookId: "twok", chapter: 4 },
      { bookId: "twok", chapter: 1 },
    ])).toBe(false);
    expect(isEvidenceUnlocked(entry, [
      { bookId: "twok", chapter: 1 },
      { bookId: "twok", chapter: 4 },
    ])).toBe(false);
  });

  it("does not let a completed duplicate override an earlier ambiguous position", () => {
    expect(isEvidenceUnlocked(entry, [
      { bookId: "twok", chapter: 1 },
      { bookId: "twok", completed: true },
    ])).toBe(false);
  });

  it("does not unlock from progress in another work", () => {
    expect(isEvidenceUnlocked(entry, [{ bookId: "wor", chapter: 99 }])).toBe(false);
  });

  it("rejects malformed progress containers", () => {
    expect(isEvidenceUnlocked(entry, null as never)).toBe(false);
  });

  it("rejects positions beyond the inspected edition chapter count", () => {
    expect(isEvidenceUnlocked(entry, [{ bookId: "tfe", chapter: 39 }])).toBe(false);
  });

  it("rejects ambiguous chapter numbers in an edition without a unit locator", () => {
    const elantrisEntry: HoidKnowledgeEntry = {
      ...entry,
      firstSafeAppearance: { bookId: "elantris", chapter: 48 },
      evidenceSource: { bookId: "elantris", chapter: 48, locatorId: "nav:forged" },
      evidenceUnlock: { bookId: "elantris", chapter: 48 },
    };
    expect(isEvidenceUnlocked(elantrisEntry, [{ bookId: "elantris", chapter: 48 }])).toBe(false);
  });

  it("rejects a forged locator even when its chapter numbers are valid", () => {
    const forged = {
      ...entry,
      evidenceSource: { bookId: "twok", chapter: 2, locatorId: "twok-chapter-2" },
    };
    expect(canonicalEvidenceScope(forged.evidenceSource, forged.evidenceUnlock)).toBeNull();
    expect(isEvidenceUnlocked(forged, [{ bookId: "twok", chapter: 75 }])).toBe(false);
  });

  it("rejects evidence for a catalogued work whose source TOC locator is unavailable", () => {
    const unavailable = {
      ...entry,
      firstSafeAppearance: { bookId: "tfe", chapter: 2 },
      evidenceSource: { bookId: "tfe", chapter: 2, locatorId: "nav:unverified" },
      evidenceUnlock: { bookId: "tfe", chapter: 2 },
    };
    expect(canonicalEvidenceScope(unavailable.evidenceSource, unavailable.evidenceUnlock)).toBeNull();
    expect(isEvidenceUnlocked(unavailable, [{ bookId: "tfe", chapter: 38 }])).toBe(false);
  });

  it("rejects an unlock threshold beyond the verified manifest", () => {
    const invalidUnlock = {
      ...entry,
      evidenceUnlock: { bookId: "twok", chapter: 76 },
    };
    expect(canonicalEvidenceScope(invalidUnlock.evidenceSource, invalidUnlock.evidenceUnlock)).toBeNull();
  });

  it("rejects accessor-bearing evidence metadata without executing getters", () => {
    let invoked = false;
    const source = { bookId: "twok", chapter: 2 } as Record<string, unknown>;
    Object.defineProperty(source, "locatorId", {
      enumerable: true,
      get: () => {
        invoked = true;
        return locator("twok", 2);
      },
    });
    expect(canonicalEvidenceScope(source, entry.evidenceUnlock)).toBeNull();
    expect(invoked).toBe(false);
  });

  it("rejects extra fields at the evidence provenance boundary", () => {
    const source = {
      bookId: "twok",
      chapter: 2,
      locatorId: locator("twok", 2),
      summary: "untrusted extra text",
    };
    expect(canonicalEvidenceScope(source, entry.evidenceUnlock)).toBeNull();
  });

});
