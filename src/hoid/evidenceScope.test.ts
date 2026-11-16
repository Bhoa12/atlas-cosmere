import { describe, expect, it } from "vitest";
import { isEvidenceUnlocked } from "./evidenceScope";
import type { HoidKnowledgeEntry } from "./catalog";

const entry: HoidKnowledgeEntry = {
  id: "e-scope-test",
  aliases: ["Elemento de prueba"],
  kind: "concept",
  firstSafeAppearance: { bookId: "tfe", chapter: 2 },
  evidenceSource: { bookId: "tfe", chapter: 2, locatorId: "tfe-chapter-2-test" },
  evidenceUnlock: { bookId: "tfe", chapter: 4 },
  provenance: "verified",
  summary: "Resumen editorial sintético para pruebas de autorización.",
};

describe("isEvidenceUnlocked public boundary", () => {
  it("unlocks only when the single canonical position reaches the evidence ceiling", () => {
    expect(isEvidenceUnlocked(entry, [{ bookId: "tfe", chapter: 3 }])).toBe(false);
    expect(isEvidenceUnlocked(entry, [{ bookId: "tfe", chapter: 4 }])).toBe(true);
  });

  it("rejects duplicate positions instead of depending on their order", () => {
    expect(isEvidenceUnlocked(entry, [
      { bookId: "tfe", chapter: 4 },
      { bookId: "tfe", chapter: 1 },
    ])).toBe(false);
    expect(isEvidenceUnlocked(entry, [
      { bookId: "tfe", chapter: 1 },
      { bookId: "tfe", chapter: 4 },
    ])).toBe(false);
  });

  it("does not let a completed duplicate override an earlier ambiguous position", () => {
    expect(isEvidenceUnlocked(entry, [
      { bookId: "tfe", chapter: 1 },
      { bookId: "tfe", completed: true },
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
      evidenceSource: { bookId: "elantris", chapter: 48, locatorId: "elantris-48" },
      evidenceUnlock: { bookId: "elantris", chapter: 48 },
    };
    expect(isEvidenceUnlocked(elantrisEntry, [{ bookId: "elantris", chapter: 48 }])).toBe(false);
  });
});
