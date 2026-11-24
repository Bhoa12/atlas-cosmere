import { describe, expect, it } from "vitest";
import { retrieveAuthorized } from "./retrieval";
import { HoidKnowledgeEntry } from "./catalog";
import { getHoidReadingManifest } from "./readingManifest";
import { ReadingPosition } from "./types";

function locator(bookId: string, chapter: number): string {
  const manifest = getHoidReadingManifest(bookId);
  if (manifest.status !== "ready") throw new Error("Synthetic manifest unavailable");
  const unit = manifest.manifest.units.find(item => item.chapterNumber === chapter);
  if (!unit?.locatorId) throw new Error("Synthetic locator unavailable");
  return unit.locatorId;
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const items: HoidKnowledgeEntry[] = [
  {
    id: "elantris-safe",
    aliases: ["Elantris", "ciudad"],
    kind: "place",
    firstSafeAppearance: { bookId: "elantris", chapter: 3 },
    evidenceSource: { bookId: "elantris", chapter: 3, locatorId: locator("elantris", 3) },
    evidenceUnlock: { bookId: "elantris", chapter: 3 },
    summary: "Resumen original de prueba.",
    provenance: "verified",
  },
  {
    id: "limited-context",
    aliases: ["limitado"],
    kind: "concept",
    firstSafeAppearance: { bookId: "elantris", chapter: 1 },
    evidenceSource: { bookId: "elantris", chapter: 1, locatorId: locator("elantris", 1) },
    evidenceUnlock: { bookId: "elantris", chapter: 1 },
    summary: "Resumen que no debe llegar al proveedor.",
    provenance: "limited",
  },
  {
    id: "missing-provenance",
    aliases: ["sinprocedencia"],
    kind: "concept",
    firstSafeAppearance: { bookId: "elantris", chapter: 1 },
    evidenceSource: { bookId: "elantris", chapter: 1, locatorId: locator("elantris", 1) },
    evidenceUnlock: { bookId: "elantris", chapter: 1 },
    summary: "Resumen sin procedencia explícita.",
  },
  {
    id: "other-book",
    aliases: ["otro"],
    kind: "concept",
    firstSafeAppearance: { bookId: "warbreaker", chapter: 1 },
    evidenceSource: { bookId: "warbreaker", chapter: 1, locatorId: locator("warbreaker", 1) },
    evidenceUnlock: { bookId: "warbreaker", chapter: 1 },
    summary: "Resumen original de prueba.",
    provenance: "verified",
  },
];

export function runRetrievalChecks(): void {
  const early: ReadingPosition[] = [{ bookId: "elantris", chapter: 2 }];
  assert(
    retrieveAuthorized(items, early, "Elantris").length === 0,
    "future chapters must not be retrieved",
  );

  const exact: ReadingPosition[] = [{ bookId: "elantris", chapter: 3 }];
  const result = retrieveAuthorized(items, exact, "¿Qué es Elantris?");
  assert(
    result.length === 1 && result[0].id === "elantris-safe",
    "the exact unlock chapter must retrieve verified matching knowledge",
  );

  const completed: ReadingPosition[] = [{ bookId: "elantris", completed: true }];
  assert(
    retrieveAuthorized(items, completed, "ciudad").length === 1,
    "completed books must authorize verified matching knowledge",
  );

  assert(
    retrieveAuthorized(items, completed, "limitado").length === 0,
    "limited provenance must never cross into provider context",
  );

  assert(
    retrieveAuthorized(items, completed, "sinprocedencia").length === 0,
    "missing provenance must fail closed",
  );

  assert(
    retrieveAuthorized(items, exact, "otro").length === 0,
    "progress in one book must never unlock another book",
  );

  const phraseItems: HoidKnowledgeEntry[] = [
    {
      id: "phrase-safe",
      aliases: ["mar esmeralda"],
      kind: "concept",
      firstSafeAppearance: { bookId: "elantris", chapter: 1 },
      evidenceSource: { bookId: "elantris", chapter: 1, locatorId: locator("elantris", 1) },
      evidenceUnlock: { bookId: "elantris", chapter: 1 },
      summary: "Resumen original de prueba.",
      provenance: "verified",
    },
  ];

  assert(
    retrieveAuthorized(phraseItems, completed, "¿Qué sabes del mar esmeralda?").length === 1,
    "multi-word aliases must still match as complete phrases",
  );
  assert(
    retrieveAuthorized(phraseItems, completed, "mar esmeraldaverde").length === 0,
    "multi-word aliases must not match inside longer unrelated words",
  );
}


describe("retrieveAuthorized exact entity context", () => {
  it("supports pronoun-only follow-ups through exact IDs without bypassing progress or provenance", () => {
    const exact: ReadingPosition[] = [{ bookId: "elantris", chapter: 3 }];
    expect(retrieveAuthorized(items, exact, "¿Y ella?", ["elantris-safe"]).map(item => item.id))
      .toEqual(["elantris-safe"]);

    const early: ReadingPosition[] = [{ bookId: "elantris", chapter: 2 }];
    expect(retrieveAuthorized(items, early, "¿Y ella?", ["elantris-safe"])).toEqual([]);

    const completed: ReadingPosition[] = [{ bookId: "elantris", completed: true }];
    expect(retrieveAuthorized(items, completed, "¿Y eso?", ["limited-context"])).toEqual([]);
  });

  it("preserves the existing lexical and provenance invariants", () => {
    expect(() => runRetrievalChecks()).not.toThrow();
  });
});
