import { prepareNarrativePipeline } from "./narrativePipeline";
import type { Evidence, SafeRequest } from "./safetyBoundary";

const request: SafeRequest = {
  question: "¿Qué debo tener presente hasta aquí?",
  intent: "explain",
  progress: { sourceId: "mistborn-era1-the-final-empire", chapter: 5 },
};

const allowed: Evidence = {
  id: "summary-5",
  sourceId: "mistborn-era1-the-final-empire",
  chapter: 5,
  summary: "Resumen original y autorizado del contexto leído.",
};

const future: Evidence = {
  ...allowed,
  id: "summary-6",
  chapter: 6,
};

const safe = prepareNarrativePipeline(request, [allowed, future]);
if (!safe.ok || safe.evidence.length !== 1 || safe.evidence[0].id !== "summary-5") {
  throw new Error("El pipeline debe conservar solo evidencia autorizada");
}

const blocked = prepareNarrativePipeline(request, [future]);
if (blocked.ok || blocked.reason !== "no-authorized-evidence") {
  throw new Error("El pipeline debe fallar cerrado sin evidencia autorizada");
}

console.log("narrativePipeline self-check passed");
