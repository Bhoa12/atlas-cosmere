import { authorizeContext } from "./safetyBoundary";

const safe = authorizeContext(
  { bookId: "mistborn-1", chapter: 3 },
  [
    { id: "a", bookId: "mistborn-1", chapter: 3, accessible: true, summary: "Resumen original." },
    { id: "future", bookId: "mistborn-1", chapter: 4, accessible: true, summary: "No debe pasar." },
    { id: "other", bookId: "elantris", chapter: 1, accessible: true, summary: "No debe pasar." },
  ],
);

if (!safe.ok || safe.context.evidence.length !== 1 || safe.context.evidence[0].id !== "a") {
  throw new Error("La frontera debe excluir capítulos futuros y otras obras.");
}

const inaccessible = authorizeContext(
  { bookId: "mistborn-1", chapter: 1 },
  [{ id: "x", bookId: "mistborn-1", chapter: 1, accessible: false, summary: "No accesible." }],
);
if (inaccessible.ok || inaccessible.reason !== "no-authorized-evidence") {
  throw new Error("La evidencia inaccesible debe bloquearse.");
}
