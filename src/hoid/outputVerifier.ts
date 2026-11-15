/**
 * Hoid IA — verificación semántica mínima de salida.
 *
 * Esta capa no decide qué hechos son ciertos: comprueba que una salida ya
 * respaldada siga declarando procedencia y que no introduzca una respuesta
 * cuando la cadena anterior ha ordenado abstenerse.
 */

export type CandidateOutput =
  | { kind: "answer"; text: string; evidenceIds: readonly string[] }
  | { kind: "abstain"; reason: string };

export type VerifiedOutput =
  | { kind: "answer"; text: string; evidenceIds: readonly string[] }
  | { kind: "abstain"; reason: "INVALID_OUTPUT" | "UPSTREAM_ABSTENTION" };

export function verifyOutput(
  candidate: CandidateOutput,
  allowedEvidenceIds: ReadonlySet<string>,
): VerifiedOutput {
  if (candidate.kind === "abstain") {
    return { kind: "abstain", reason: "UPSTREAM_ABSTENTION" };
  }

  const text = candidate.text.trim();
  const uniqueEvidence = [...new Set(candidate.evidenceIds)];

  if (
    !text ||
    uniqueEvidence.length === 0 ||
    uniqueEvidence.some((id) => !id.trim() || !allowedEvidenceIds.has(id))
  ) {
    return { kind: "abstain", reason: "INVALID_OUTPUT" };
  }

  return { kind: "answer", text, evidenceIds: uniqueEvidence };
}
