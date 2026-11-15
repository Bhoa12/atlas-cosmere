import { verifyClaims } from "./claimContract";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const allowed = new Set(["mistborn-chapter-2-summary", "roshar-chapter-5-summary"]);

const supported = verifyClaims(
  [{ text: "Afirmación respaldada.", evidenceIds: ["mistborn-chapter-2-summary"] }],
  allowed,
);
assert(supported.kind === "verified", "Una afirmación respaldada debe verificarse");

const future = verifyClaims(
  [
    { text: "Afirmación segura.", evidenceIds: ["mistborn-chapter-2-summary"] },
    { text: "Afirmación futura.", evidenceIds: ["future-chapter-summary"] },
  ],
  allowed,
);
assert(future.kind === "abstain", "Una sola afirmación futura debe bloquear el conjunto completo");

const emptyEvidence = verifyClaims(
  [{ text: "Sin respaldo.", evidenceIds: [] }],
  allowed,
);
assert(emptyEvidence.kind === "abstain", "Toda afirmación debe declarar evidencia");

const emptyClaims = verifyClaims([], allowed);
assert(emptyClaims.kind === "abstain", "Un borrador sin afirmaciones debe abstenerse");
