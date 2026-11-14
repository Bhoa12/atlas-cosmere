/**
 * Provider-neutral contract for Hoid IA.
 *
 * Providers receive only a request-local knowledge boundary. They cannot access
 * the private catalog or invent evidence authority; all narrative claims must
 * be returned with evidence identifiers that are verified after generation.
 */
import {
  type EvidenceId,
  type KnowledgeBoundary,
  verifyEvidenceReferences,
} from "./knowledgeBoundary";

export type HoidPrompt = Readonly<{
  text: string;
  workId?: string;
  chapter?: number;
}>;

export type ProviderRequest = Readonly<{
  prompt: HoidPrompt;
  allowedEvidenceIds: readonly EvidenceId[];
}>;

export type ProviderNarrativeClaim = Readonly<{
  text: string;
  evidenceIds: readonly EvidenceId[];
}>;

export type ProviderResponse = Readonly<{
  answer: string;
  claims: readonly ProviderNarrativeClaim[];
}>;

export interface HoidProvider {
  readonly name: string;
  answer(request: ProviderRequest): Promise<ProviderResponse>;
}

export type VerifiedProviderResponse = Readonly<{
  answer: string;
  acceptedClaims: readonly ProviderNarrativeClaim[];
  rejectedClaims: number;
}>;

export function createProviderRequest(
  boundary: KnowledgeBoundary,
  prompt: HoidPrompt,
): ProviderRequest {
  const text = prompt.text.trim();
  if (!text) throw new Error("Prompt text must be non-empty");
  if (prompt.chapter !== undefined &&
      (!Number.isInteger(prompt.chapter) || prompt.chapter < 1)) {
    throw new Error("Prompt chapter must be a positive integer");
  }

  return Object.freeze({
    prompt: Object.freeze({
      text,
      ...(prompt.workId?.trim() ? { workId: prompt.workId.trim() } : {}),
      ...(prompt.chapter !== undefined ? { chapter: prompt.chapter } : {}),
    }),
    allowedEvidenceIds: Object.freeze([...boundary.evidenceIds]),
  });
}

/**
 * Fail closed at the provider boundary: a claim with any unauthorized reference
 * is rejected as a whole, because its prose may depend on future knowledge.
 */
export function verifyProviderResponse(
  boundary: KnowledgeBoundary,
  response: ProviderResponse,
): VerifiedProviderResponse {
  const answer = response.answer.trim();
  const acceptedClaims: ProviderNarrativeClaim[] = [];
  let rejectedClaims = 0;

  for (const claim of response.claims) {
    const text = claim.text.trim();
    const uniqueInput = [...new Set(claim.evidenceIds)];
    const references = verifyEvidenceReferences(boundary, uniqueInput);

    if (!text || references.length === 0 || references.length !== uniqueInput.length) {
      rejectedClaims++;
      continue;
    }

    acceptedClaims.push(Object.freeze({
      text,
      evidenceIds: references,
    }));
  }

  return Object.freeze({
    answer,
    acceptedClaims: Object.freeze(acceptedClaims),
    rejectedClaims,
  });
}
