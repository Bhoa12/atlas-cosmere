import {
  presentHoidEvidenceAnswer,
  type HoidAnswerPresentation,
} from "./answerPresentation";

/**
 * Explanation depth is a deterministic presentation budget, not an
 * authorization level. Every depth consumes the same already-authorized
 * evidence set and cannot widen the reader's spoiler boundary.
 */
export const HOID_EXPLANATION_DEPTHS = Object.freeze([
  "brief",
  "detailed",
  "comparative",
] as const);

export type HoidExplanationDepth = (typeof HOID_EXPLANATION_DEPTHS)[number];

export type HoidExplanationDepthBudget = Readonly<{
  maxClaims: number;
  maxEvidence: number;
  maxWorks: number;
  maxCharacters: number;
  minimumWorks: number;
  requireSegmentProvenance: boolean;
  requireCrossWorkSegment: boolean;
}>;

export const HOID_EXPLANATION_DEPTH_BUDGETS: Readonly<
  Record<HoidExplanationDepth, HoidExplanationDepthBudget>
> = Object.freeze({
  brief: Object.freeze({
    maxClaims: 3,
    maxEvidence: 4,
    maxWorks: 2,
    maxCharacters: 6_000,
    minimumWorks: 1,
    requireSegmentProvenance: false,
    requireCrossWorkSegment: false,
  }),
  detailed: Object.freeze({
    maxClaims: 8,
    maxEvidence: 12,
    maxWorks: 4,
    maxCharacters: 18_000,
    minimumWorks: 1,
    requireSegmentProvenance: false,
    requireCrossWorkSegment: false,
  }),
  comparative: Object.freeze({
    maxClaims: 12,
    maxEvidence: 16,
    maxWorks: 4,
    maxCharacters: 24_000,
    minimumWorks: 2,
    requireSegmentProvenance: true,
    requireCrossWorkSegment: true,
  }),
});

export type HoidExplanationMetrics = Readonly<{
  claimCount: number;
  evidenceCount: number;
  workCount: number;
  characterCount: number;
}>;

export type HoidExplanationWithheldReason =
  | Extract<HoidAnswerPresentation, { status: "withheld" }>["reason"]
  | "invalid-depth"
  | "depth-budget-exceeded"
  | "comparison-provenance-required";

export type HoidExplanationResult =
  | Readonly<{
      status: "ready";
      depth: HoidExplanationDepth;
      budget: HoidExplanationDepthBudget;
      metrics: HoidExplanationMetrics;
      presentation: Extract<HoidAnswerPresentation, { status: "ready" }>;
    }>
  | Readonly<{
      status: "withheld";
      reason: HoidExplanationWithheldReason;
      text: string;
    }>;

const WITHHELD_TEXT =
  "Hoid no puede ofrecer una explicación con ese nivel de detalle sin superar los límites de evidencia autorizada.";

function isExplanationDepth(value: unknown): value is HoidExplanationDepth {
  return typeof value === "string" &&
    (HOID_EXPLANATION_DEPTHS as readonly string[]).includes(value);
}

function withheld(
  reason: HoidExplanationWithheldReason,
  text = WITHHELD_TEXT,
): HoidExplanationResult {
  return Object.freeze({ status: "withheld", reason, text });
}

/** Return the immutable, provider-neutral budget for a supported depth. */
export function resolveHoidExplanationDepthBudget(
  depth: unknown,
): HoidExplanationDepthBudget | null {
  if (!isExplanationDepth(depth)) return null;
  return HOID_EXPLANATION_DEPTH_BUDGETS[depth];
}

/**
 * Applies a deterministic depth budget after the source-aware presentation
 * boundary has revalidated every claim and citation against the live progress.
 *
 * This function never truncates, rewrites, reorders or generates prose. An
 * answer that exceeds its requested budget is withheld in full so dependent
 * reasoning cannot be silently removed.
 */
export function presentHoidExplanation(
  answer: unknown,
  progress: unknown,
  depthInput: unknown,
): HoidExplanationResult {
  const budget = resolveHoidExplanationDepthBudget(depthInput);
  if (!budget || !isExplanationDepth(depthInput)) return withheld("invalid-depth");

  const presentation = presentHoidEvidenceAnswer(answer, progress);
  if (presentation.status !== "ready") {
    return withheld(presentation.reason, presentation.text);
  }

  const workIds = new Set(presentation.citations.map(citation => citation.sourceBookId));
  const metrics: HoidExplanationMetrics = Object.freeze({
    claimCount: presentation.claimIds.length,
    evidenceCount: presentation.evidenceIds.length,
    workCount: workIds.size,
    characterCount: presentation.text.length,
  });

  if (
    metrics.claimCount > budget.maxClaims ||
    metrics.evidenceCount > budget.maxEvidence ||
    metrics.workCount > budget.maxWorks ||
    metrics.characterCount > budget.maxCharacters
  ) return withheld("depth-budget-exceeded");

  if (metrics.workCount < budget.minimumWorks) {
    return withheld("comparison-provenance-required");
  }

  if (budget.requireSegmentProvenance) {
    if (!presentation.segments || !presentation.layout) {
      return withheld("comparison-provenance-required");
    }

    if (budget.requireCrossWorkSegment) {
      const hasCrossWorkClaim = presentation.segments.some(segment =>
        new Set(segment.citations.map(citation => citation.sourceBookId)).size >= 2,
      );
      if (!hasCrossWorkClaim) {
        return withheld("comparison-provenance-required");
      }
    }
  }

  return Object.freeze({
    status: "ready",
    depth: depthInput,
    budget,
    metrics,
    presentation,
  });
}
