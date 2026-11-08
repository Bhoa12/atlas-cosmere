import { retrieveAuthorized } from "./retrieval";
import { HoidKnowledgeEntry } from "./catalog";
import { ReadingPosition } from "./types";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const items: HoidKnowledgeEntry[] = [
  {
    id: "elantris-safe",
    aliases: ["Elantris", "ciudad"],
    kind: "place",
    firstSafeAppearance: { bookId: "elantris", chapter: 3 },
    summary: "Resumen original de prueba.",
    provenance: "verified",
  },
  {
    id: "limited-context",
    aliases: ["limitado"],
    kind: "concept",
    firstSafeAppearance: { bookId: "elantris", chapter: 1 },
    summary: "Resumen que no debe llegar al proveedor.",
    provenance: "limited",
  },
  {
    id: "missing-provenance",
    aliases: ["sinprocedencia"],
    kind: "concept",
    firstSafeAppearance: { bookId: "elantris", chapter: 1 },
    summary: "Resumen sin procedencia explícita.",
  },
  {
    id: "other-book",
    aliases: ["otro"],
    kind: "concept",
    firstSafeAppearance: { bookId: "warbreaker", chapter: 1 },
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
}
