/**
 * Recommendation safety contract.
 *
 * Recommendations are a separate response surface: a narrative recommendation
 * must not bypass the request knowledge boundary, while structural reading
 * guidance must not imply access to narrative content.
 */
import { type EvidenceId, type KnowledgeBoundary, verifyEvidenceReferences } from "./knowledgeBoundary";

export type Recommendation =
  | Readonly<{ kind: "structural"; text: string }>
  | Readonly<{ kind: "narrative"; text: string; evidenceIds: readonly EvidenceId[] }>;

export type VerifiedRecommendations = Readonly<{
  accepted: readonly Recommendation[];
  rejected: number;
}>;

export function verifyRecommendations(
  boundary: KnowledgeBoundary,
  recommendations: readonly Recommendation[],
): VerifiedRecommendations {
  const accepted: Recommendation[] = [];
  let rejected = 0;

  for (const recommendation of recommendations) {
    const text = recommendation.text.trim();
    if (!text) { rejected++; continue; }

    if (recommendation.kind === "structural") {
      accepted.push(Object.freeze({ kind: "structural", text }));
      continue;
    }

    const references = verifyEvidenceReferences(boundary, recommendation.evidenceIds);
    if (references.length === 0 ||
        references.length !== new Set(recommendation.evidenceIds).size) {
      rejected++;
      continue;
    }

    accepted.push(Object.freeze({
      kind: "narrative",
      text,
      evidenceIds: references,
    }));
  }

  return Object.freeze({ accepted: Object.freeze(accepted), rejected });
}
