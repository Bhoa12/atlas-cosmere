import { verifyAnswerProvenance } from "./answerProvenance";

const evidence = [{
  id: "mistborn-1-c3",
  bookId: "mistborn-1",
  chapter: 3,
  accessible: true,
  summary: "Resumen original autorizado.",
}];

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const safe = verifyAnswerProvenance(
  [{ text: "Explicación respaldada.", evidenceIds: ["mistborn-1-c3"] }],
  evidence,
);
expect(safe.kind === "approved", "La evidencia autorizada debe aprobarse.");

const future = verifyAnswerProvenance(
  [{ text: "Dato no respaldado.", evidenceIds: ["mistborn-1-c99"] }],
  evidence,
);
expect(future.kind === "abstain", "La evidencia desconocida debe bloquearse.");

const unsupported = verifyAnswerProvenance(
  [{ text: "Afirmación sin fuentes.", evidenceIds: [] }],
  evidence,
);
expect(unsupported.kind === "abstain", "Las afirmaciones sin evidencia deben bloquearse.");
