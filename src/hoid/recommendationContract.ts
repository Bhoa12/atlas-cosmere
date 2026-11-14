import type { HoidProvider, ProviderRequest, ProviderDraft } from "./providerContract";

export type RecommendationReason =
  | Readonly<{ kind: "preference"; id: string }>
  | Readonly<{ kind: "catalog"; id: string }>
  | Readonly<{ kind: "progress"; id: string }>;

export type RecommendationDraft = Readonly<{
  text: string;
  reasons: readonly RecommendationReason[];
}>;

export type RecommendationProvider = Readonly<{
  recommend(request: ProviderRequest): Promise<readonly RecommendationDraft[]>;
}>;

/**
 * Recommendations are non-narrative unless separately passed through the
 * evidence pipeline. This verifier rejects empty text, empty reasons and
 * reasons outside the caller-authorized metadata identifiers.
 */
export function verifyRecommendations(
  drafts: readonly RecommendationDraft[],
  allowedReasonIds: ReadonlySet<string>,
): readonly RecommendationDraft[] {
  const verified: RecommendationDraft[] = [];
  for (const draft of drafts) {
    if (!draft.text.trim() || draft.reasons.length === 0) continue;
    if (draft.reasons.some((reason) => !reason.id.trim() || !allowedReasonIds.has(reason.id))) continue;
    const unique = new Map(draft.reasons.map((reason) => [`${reason.kind}:${reason.id}`, reason]));
    verified.push(Object.freeze({ text: draft.text, reasons: Object.freeze([...unique.values()]) }));
  }
  return Object.freeze(verified);
}

/** Structural compatibility guard for adapters that expose both capabilities. */
export function isRecommendationCapable(provider: HoidProvider | RecommendationProvider): provider is HoidProvider & RecommendationProvider {
  return typeof (provider as RecommendationProvider).recommend === "function";
}
