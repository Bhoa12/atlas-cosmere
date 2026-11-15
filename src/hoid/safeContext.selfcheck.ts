import { buildSafeContext } from "./safeContext";

const progress = { "mistborn-era1-1": 3 };
const context = buildSafeContext("mistborn-era1-1", progress, [
  { id: "safe", sourceId: "mistborn-era1-1", chapter: 3, summary: "Resumen original.", accessible: true },
  { id: "future", sourceId: "mistborn-era1-1", chapter: 4, summary: "No debe entrar.", accessible: true },
  { id: "other", sourceId: "elantris", chapter: 1, summary: "No debe entrar.", accessible: true },
  { id: "blocked", sourceId: "mistborn-era1-1", chapter: 2, summary: "No accesible.", accessible: false },
]);

if (!context || context.evidence.length !== 1 || context.evidence[0].id !== "safe") {
  throw new Error("Hoid safe-context contract failed");
}

if (buildSafeContext("unknown", progress, []) !== null) {
  throw new Error("Unknown sources must fail closed");
}
