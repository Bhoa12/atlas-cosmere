import { verifyOutput } from "./outputVerifier";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const allowed = new Set(["chapter-3-summary"]);

const valid = verifyOutput(
  { kind: "answer", text: "  Respuesta segura.  ", evidenceIds: ["chapter-3-summary"] },
  allowed,
);
assert(valid.kind === "answer", "La evidencia autorizada debe conservar la respuesta");

const future = verifyOutput(
  { kind: "answer", text: "Respuesta", evidenceIds: ["chapter-9-summary"] },
  allowed,
);
assert(future.kind === "abstain", "La evidencia no autorizada debe bloquear la salida");

const empty = verifyOutput(
  { kind: "answer", text: "   ", evidenceIds: ["chapter-3-summary"] },
  allowed,
);
assert(empty.kind === "abstain", "Una respuesta vacía debe bloquearse");

const abstained = verifyOutput(
  { kind: "abstain", reason: "NO_AUTHORIZED_EVIDENCE" },
  allowed,
);
assert(abstained.kind === "abstain", "La abstención previa no debe convertirse en respuesta");
