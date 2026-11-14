import type { EvidenceRef, ReadingProgress } from "./responsePolicy";
import type { HoidProvider, ProviderRequest, VerifiedClaim } from "./providerContract";
import { verifyProviderDraft } from "./providerContract";
import { authorizeResponseEvidence } from "./responsePolicy";

export type SafeGenerationInput = Readonly<{ question: string; progress: ReadingProgress; evidence: readonly EvidenceRef[] }>;
export type SafeGenerationResult = Readonly<{ status: "authorized" | "abstain"; claims: readonly VerifiedClaim[] }>;

/** Provider orchestration with fail-closed progress and evidence boundaries. */
export async function generateSafely(provider: HoidProvider, input: SafeGenerationInput): Promise<SafeGenerationResult> {
  const authorizedEvidence = authorizeResponseEvidence({ mode: "explain", progress: input.progress, evidence: [...input.evidence] });
  if (authorizedEvidence.length === 0) return Object.freeze({ status: "abstain" as const, claims: Object.freeze([]) });
  const request: ProviderRequest = Object.freeze({
    question: input.question,
    context: Object.freeze({ evidenceIds: Object.freeze(authorizedEvidence.map((item) => item.id)) }),
  });
  const draft = await provider.generate(request);
  const claims = verifyProviderDraft(request.context, draft);
  return Object.freeze({ status: claims.length > 0 ? "authorized" as const : "abstain" as const, claims });
}