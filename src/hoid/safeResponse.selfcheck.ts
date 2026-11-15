import { finalizeAnswer } from "./safeResponse";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const accepted = finalizeAnswer({
  kind: "answer",
  text: "Explicación respaldada.",
  evidenceIds: ["ev-1", "ev-1"],
  bookId: "el-imperio-final",
  maxChapter: 12,
});
assert(accepted.kind === "answer", "La respuesta respaldada debe aceptarse.");
if (accepted.kind === "answer") assert(accepted.evidenceIds.length === 1, "La procedencia debe normalizarse.");

const missingEvidence = finalizeAnswer({
  kind: "answer",
  text: "No verificable",
  evidenceIds: [],
  bookId: "el-imperio-final",
  maxChapter: 12,
});
assert(missingEvidence.kind === "abstention", "Sin procedencia debe haber abstención.");

const invalidScope = finalizeAnswer({
  kind: "answer",
  text: "Fuera de alcance",
  evidenceIds: ["ev-1"],
  bookId: "",
  maxChapter: 0,
});
assert(invalidScope.kind === "abstention", "Un alcance inválido debe bloquearse.");
