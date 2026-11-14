import { verifyExplanation } from "./explanationContract";

const safe = new Set(["ev-1", "ev-2"]);
const accepted = verifyExplanation({
  mode: "definition",
  units: [{ id: "u1", text: "Explicación original.", evidenceIds: ["ev-1"] }],
}, safe);
if (!accepted.ok || accepted.text !== "Explicación original.") throw new Error("safe explanation rejected");

const mixed = verifyExplanation({
  mode: "recap",
  units: [
    { id: "u1", text: "Parte segura.", evidenceIds: ["ev-1"] },
    { id: "u2", text: "Parte futura.", evidenceIds: ["future"] },
  ],
}, safe);
if (mixed.ok || mixed.reason !== "unauthorized-evidence") throw new Error("mixed explanation was not rejected atomically");

const missing = verifyExplanation({
  mode: "relationship",
  units: [{ id: "u1", text: "Sin respaldo.", evidenceIds: [] }],
}, safe);
if (missing.ok || missing.reason !== "missing-evidence") throw new Error("unbacked explanation was accepted");
