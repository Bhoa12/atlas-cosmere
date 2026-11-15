/**
 * Final provenance gate for Hoid IA.
 *
 * This module intentionally knows nothing about EPUB text or AI providers.
 * It only accepts original summaries and evidence identifiers that were
 * already authorized by earlier spoiler-safety layers.
 */

export type HoidEvidence = {
  id: string;
  bookId: string;
  chapter: number;
  accessible: boolean;
  summary: string;
};

export type HoidClaim = {
  text: string;
  evidenceIds: string[];
};

export type ProvenanceResult =
  | { kind: "approved"; claims: HoidClaim[]; evidenceIds: string[] }
  | { kind: "abstain"; reason: string };

function normalized(value: string): string {
  return value.trim();
}

export function verifyAnswerProvenance(
  claims: HoidClaim[],
  authorizedEvidence: HoidEvidence[],
): ProvenanceResult {
  if (!Array.isArray(claims) || claims.length === 0) {
    return { kind: "abstain", reason: "No hay afirmaciones verificables." };
  }

  const allowed = new Map<string, HoidEvidence>();
  for (const evidence of authorizedEvidence) {
    const id = normalized(evidence.id);
    if (
      id &&
      evidence.accessible &&
      Number.isInteger(evidence.chapter) &&
      evidence.chapter > 0 &&
      normalized(evidence.summary)
    ) {
      allowed.set(id, evidence);
    }
  }

  if (allowed.size === 0) {
    return { kind: "abstain", reason: "No hay evidencia accesible autorizada." };
  }

  const used = new Set<string>();
  for (const claim of claims) {
    if (!normalized(claim.text) || !Array.isArray(claim.evidenceIds) || claim.evidenceIds.length === 0) {
      return { kind: "abstain", reason: "Existe una afirmación sin procedencia suficiente." };
    }

    for (const rawId of claim.evidenceIds) {
      const id = normalized(rawId);
      if (!id || !allowed.has(id)) {
        return { kind: "abstain", reason: "La respuesta referencia evidencia no autorizada." };
      }
      used.add(id);
    }
  }

  return { kind: "approved", claims, evidenceIds: [...used] };
}
