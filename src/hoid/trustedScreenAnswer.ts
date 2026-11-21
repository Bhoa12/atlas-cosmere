import type {
  HoidAnswerPresentation,
  HoidPresentedCitation,
  HoidPresentedSegment,
} from "./answerPresentation";
import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import {
  isHoidExplanationDepth,
  resolveHoidExplanationDepthBudget,
  type HoidExplanationDepth,
  type HoidExplanationMetrics,
} from "./explanationDepth";
import { composeHoidNarrative, type HoidNarrativeLayout } from "./narrativeComposition";
import type { HoidTrustedVerifiedAnswerPresenter } from "./trustedVerifiedAnswerPresentation";

export type HoidTrustedScreenAnswerResult =
  | Readonly<{
      status: "ready";
      depth: HoidExplanationDepth;
      metrics: HoidExplanationMetrics;
      presentation: Extract<HoidAnswerPresentation, { status: "ready" }>;
    }>
  | Readonly<{
      status: "withheld";
      reason:
        | "presenter-unavailable"
        | "presenter-withheld"
        | "invalid-depth"
        | "invalid-presentation"
        | "depth-budget-exceeded"
        | "segment-provenance-required"
        | "comparison-provenance-required";
      text: string;
    }>;

export type HoidTrustedScreenAnswerPort = Readonly<{
  /** The presenter obtains progress from its host-owned port; callers cannot supply a cursor. */
  present(answer: unknown, depth: unknown): Promise<HoidTrustedScreenAnswerResult>;
}>;

type UnknownMethod = (...args: unknown[]) => unknown;
const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const MAX_TEXT_LENGTH = 32_000;
const TITLES = new Map(HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work.title] as const));

const WITHHELD_TEXT =
  "Hoid no puede mostrar esta respuesta porque la autoridad de presentación o sus evidencias no han superado la validación.";

function withheld(
  reason: Extract<HoidTrustedScreenAnswerResult, { status: "withheld" }>["reason"],
): HoidTrustedScreenAnswerResult {
  return Object.freeze({ status: "withheld", reason, text: WITHHELD_TEXT });
}

function exactRecord(
  value: unknown,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = [],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const allowed = new Set([...requiredKeys, ...optionalKeys]);
    const keys = Reflect.ownKeys(value);
    if (keys.length < requiredKeys.length || keys.length > allowed.size) return null;

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !allowed.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    for (const key of requiredKeys) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    }
    return result;
  } catch {
    return null;
  }
}

function denseArray(value: unknown, minimum: number, maximum: number): readonly unknown[] | null {
  try {
    if (
      !Array.isArray(value) ||
      value.length < minimum ||
      value.length > maximum ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;

    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result.push(descriptor.value);
    }
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length) {
        return null;
      }
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function canonicalIds(value: unknown, maximum: number): readonly string[] | null {
  const entries = denseArray(value, 1, maximum);
  if (!entries) return null;
  const result: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (
      typeof entry !== "string" ||
      entry.length > 128 ||
      !ID_PATTERN.test(entry) ||
      seen.has(entry)
    ) return null;
    seen.add(entry);
    result.push(entry);
  }
  return Object.freeze(result);
}

function canonicalCitation(value: unknown): HoidPresentedCitation | null {
  const raw = exactRecord(
    value,
    ["evidenceId", "sourceBookId", "title", "chapter", "locatorId"],
  );
  if (
    !raw ||
    typeof raw.evidenceId !== "string" ||
    !ID_PATTERN.test(raw.evidenceId) ||
    typeof raw.sourceBookId !== "string" ||
    !TITLES.has(raw.sourceBookId) ||
    raw.title !== TITLES.get(raw.sourceBookId) ||
    typeof raw.chapter !== "number" ||
    !Number.isSafeInteger(raw.chapter) ||
    raw.chapter < 1 ||
    typeof raw.locatorId !== "string" ||
    raw.locatorId.length < 1 ||
    raw.locatorId.length > 256 ||
    /[\u0000-\u001F\u007F]/u.test(raw.locatorId)
  ) return null;

  return Object.freeze({
    evidenceId: raw.evidenceId,
    sourceBookId: raw.sourceBookId,
    title: raw.title,
    chapter: raw.chapter,
    locatorId: raw.locatorId,
  });
}

function sameCitation(left: HoidPresentedCitation, right: HoidPresentedCitation): boolean {
  return left.evidenceId === right.evidenceId &&
    left.sourceBookId === right.sourceBookId &&
    left.title === right.title &&
    left.chapter === right.chapter &&
    left.locatorId === right.locatorId;
}

function canonicalPresentation(value: unknown): Extract<HoidAnswerPresentation, { status: "ready" }> | null {
  const raw = exactRecord(
    value,
    ["status", "text", "claimIds", "evidenceIds", "citations"],
    ["layout", "segments"],
  );
  if (
    !raw ||
    raw.status !== "ready" ||
    typeof raw.text !== "string" ||
    raw.text.length < 1 ||
    raw.text.length > MAX_TEXT_LENGTH ||
    raw.text !== raw.text.trim() ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(raw.text)
  ) return null;

  const claimIds = canonicalIds(raw.claimIds, 12);
  const evidenceIds = canonicalIds(raw.evidenceIds, 16);
  const rawCitations = denseArray(raw.citations, 1, 16);
  if (!claimIds || !evidenceIds || !rawCitations || rawCitations.length !== evidenceIds.length) {
    return null;
  }

  const citations: HoidPresentedCitation[] = [];
  const citationById = new Map<string, HoidPresentedCitation>();
  for (const entry of rawCitations) {
    const citation = canonicalCitation(entry);
    if (!citation || citationById.has(citation.evidenceId)) return null;
    citationById.set(citation.evidenceId, citation);
    citations.push(citation);
  }
  if (
    evidenceIds.some(id => !citationById.has(id)) ||
    citations.some(citation => !evidenceIds.includes(citation.evidenceId))
  ) return null;

  const hasLayout = Object.prototype.hasOwnProperty.call(raw, "layout");
  const hasSegments = Object.prototype.hasOwnProperty.call(raw, "segments");
  if (hasLayout !== hasSegments) return null;

  if (!hasSegments) {
    return Object.freeze({
      status: "ready",
      text: raw.text,
      claimIds,
      evidenceIds,
      citations: Object.freeze(citations),
    });
  }

  const layout = raw.layout;
  if (layout !== "plain" && layout !== "numbered" && layout !== "grouped") return null;
  const rawSegments = denseArray(raw.segments, 1, 12);
  if (!rawSegments || rawSegments.length !== claimIds.length) return null;

  const segments: HoidPresentedSegment[] = [];
  const referencedEvidence = new Set<string>();
  const narrativeSegments: { claimId: string; text: string; evidenceIds: readonly string[] }[] = [];

  for (let index = 0; index < rawSegments.length; index += 1) {
    const segment = exactRecord(rawSegments[index], ["claimId", "text", "evidenceIds", "citations"]);
    if (
      !segment ||
      segment.claimId !== claimIds[index] ||
      typeof segment.text !== "string" ||
      segment.text.length < 1 ||
      segment.text.length > 4_000 ||
      segment.text !== segment.text.trim()
    ) return null;

    const segmentEvidenceIds = canonicalIds(segment.evidenceIds, 16);
    const segmentRawCitations = denseArray(segment.citations, 1, 16);
    if (!segmentEvidenceIds || !segmentRawCitations || segmentEvidenceIds.length !== segmentRawCitations.length) {
      return null;
    }

    const segmentCitations: HoidPresentedCitation[] = [];
    for (const entry of segmentRawCitations) {
      const citation = canonicalCitation(entry);
      const topLevelCitation = citation ? citationById.get(citation.evidenceId) : undefined;
      if (!citation || !topLevelCitation || !sameCitation(citation, topLevelCitation)) return null;
      segmentCitations.push(citation);
    }
    if (
      segmentEvidenceIds.some(id => !segmentCitations.some(citation => citation.evidenceId === id)) ||
      segmentCitations.some(citation => !segmentEvidenceIds.includes(citation.evidenceId))
    ) return null;

    for (const id of segmentEvidenceIds) referencedEvidence.add(id);
    const frozenEvidenceIds = Object.freeze([...segmentEvidenceIds]);
    segments.push(Object.freeze({
      claimId: segment.claimId as string,
      text: segment.text,
      evidenceIds: frozenEvidenceIds,
      citations: Object.freeze(segmentCitations),
    }));
    narrativeSegments.push(Object.freeze({
      claimId: segment.claimId as string,
      text: segment.text,
      evidenceIds: frozenEvidenceIds,
    }));
  }

  if (
    referencedEvidence.size !== evidenceIds.length ||
    evidenceIds.some(id => !referencedEvidence.has(id))
  ) return null;

  const composition = composeHoidNarrative({ segments: narrativeSegments }, layout);
  if (composition.status !== "ready" || composition.text !== raw.text) return null;

  return Object.freeze({
    status: "ready",
    text: raw.text,
    claimIds,
    evidenceIds,
    citations: Object.freeze(citations),
    layout: layout as HoidNarrativeLayout,
    segments: Object.freeze(segments),
  });
}

function resolvePresenterMethod(value: unknown): UnknownMethod | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    let current: object | null = value;
    for (let depth = 0; current !== null && current !== Object.prototype && depth < 5; depth += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(current, "present");
      if (descriptor) {
        if (
          !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          typeof descriptor.value !== "function"
        ) return null;
        return (descriptor.value as UnknownMethod).bind(value);
      }
      current = Object.getPrototypeOf(current) as object | null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * UI-facing adapter. It accepts only an answer candidate and a presentation
 * depth; reading progress is deliberately absent because the trusted presenter
 * refreshes it from the host-owned durable store on every call.
 */
export function createHoidTrustedScreenAnswerPort(
  presenterInput: HoidTrustedVerifiedAnswerPresenter | unknown,
): HoidTrustedScreenAnswerPort | null {
  const present = resolvePresenterMethod(presenterInput);
  if (!present) return null;

  return Object.freeze({
    async present(answer: unknown, depthInput: unknown): Promise<HoidTrustedScreenAnswerResult> {
      if (!isHoidExplanationDepth(depthInput)) return withheld("invalid-depth");
      const budget = resolveHoidExplanationDepthBudget(depthInput);
      if (!budget) return withheld("invalid-depth");

      let rawPresentation: unknown;
      try {
        rawPresentation = await Promise.resolve(present(answer));
      } catch {
        return withheld("presenter-withheld");
      }

      const presentation = canonicalPresentation(rawPresentation);
      if (!presentation) return withheld("presenter-withheld");

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

      if (budget.requireSegmentProvenance && (!presentation.segments || !presentation.layout)) {
        return withheld("segment-provenance-required");
      }

      if (budget.requireCrossWorkSegment) {
        const hasCrossWorkSegment = presentation.segments?.some(segment =>
          new Set(segment.citations.map(citation => citation.sourceBookId)).size >= 2,
        ) ?? false;
        if (!hasCrossWorkSegment) return withheld("comparison-provenance-required");
      }

      if (metrics.workCount < budget.minimumWorks) {
        return withheld("comparison-provenance-required");
      }

      return Object.freeze({
        status: "ready",
        depth: depthInput,
        metrics,
        presentation,
      });
    },
  });
}
