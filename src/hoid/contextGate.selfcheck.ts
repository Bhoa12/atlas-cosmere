import { admitEvidence, buildSafeContext } from "./contextGate";

const progress = new Map([["mistborn-1", 5]]);
const safe = { id: "s1", workId: "mistborn-1", chapter: 5, summary: "Resumen original.", provenance: "accessible-original-summary" } as const;
const future = { ...safe, id: "s2", chapter: 6 };
const other = { ...safe, id: "s3", workId: "warbreaker" };

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

assert(admitEvidence(progress, safe).ok, "El capítulo alcanzado debe admitirse");
assert(!admitEvidence(progress, future).ok, "El capítulo futuro debe rechazarse");
assert(!admitEvidence(progress, other).ok, "Una obra sin progreso debe rechazarse");
assert(buildSafeContext(progress, [safe, future, other]).length === 1, "Solo la evidencia autorizada puede entrar en contexto");
