import type {
  HoidAnswerPresentation,
  HoidPresentedCitation,
} from "./answerPresentation";
import type {
  HoidCrossBookEvidenceSummary,
  HoidCrossBookSegmentWorkEvidence,
  HoidCrossBookWorkEvidence,
} from "./crossBookEvidence";
import type { HoidNarrativeLayout } from "./narrativeComposition";

/**
 * Minimal citation metadata retained by the chat UI after the trusted
 * presenter has validated the complete evidence record against live progress.
 * Internal EPUB locators, unlock thresholds and evidence IDs stay in the
 * trusted pipeline and are not copied into React message state.
 */
export type HoidDisplayCitation = Readonly<{
  sourceBookId: string;
  title: string;
  chapter: number;
}>;

export type HoidDisplaySegment = Readonly<{
  claimId: string;
  text: string;
  citations: readonly HoidDisplayCitation[];
}>;

export type HoidDisplayCrossBookWorkEvidence = Readonly<{
  sourceBookId: string;
  title: string;
  chapters: readonly number[];
}>;

export type HoidDisplayCrossBookSegmentEvidence = Readonly<{
  claimId: string;
  works: readonly HoidDisplayCrossBookWorkEvidence[];
}>;

export type HoidDisplayCrossBookEvidenceSummary = Readonly<{
  workCount: number;
  works: readonly HoidDisplayCrossBookWorkEvidence[];
  segments: readonly HoidDisplayCrossBookSegmentEvidence[];
}>;

export type HoidAnswerDisplayProjection = Readonly<{
  text: string;
  citations: readonly HoidDisplayCitation[];
  layout?: HoidNarrativeLayout;
  segments?: readonly HoidDisplaySegment[];
}>;

function projectCitation(citation: HoidPresentedCitation): HoidDisplayCitation {
  return Object.freeze({
    sourceBookId: citation.sourceBookId,
    title: citation.title,
    chapter: citation.chapter,
  });
}

function projectCrossBookWork(
  work: HoidCrossBookWorkEvidence | HoidCrossBookSegmentWorkEvidence,
): HoidDisplayCrossBookWorkEvidence {
  return Object.freeze({
    sourceBookId: work.sourceBookId,
    title: work.title,
    chapters: Object.freeze([...work.chapters]),
  });
}

/**
 * Remove evidence IDs and internal provenance arrays from the cross-work
 * summary. The UI only needs canonical work titles and chapter numbers.
 */
export function projectHoidCrossBookEvidenceForDisplay(
  summary: HoidCrossBookEvidenceSummary,
): HoidDisplayCrossBookEvidenceSummary | null {
  if (
    !Number.isSafeInteger(summary.workCount) ||
    summary.workCount < 2 ||
    summary.works.length !== summary.workCount ||
    summary.segments.length < 1
  ) return null;

  return Object.freeze({
    workCount: summary.workCount,
    works: Object.freeze(summary.works.map(projectCrossBookWork)),
    segments: Object.freeze(summary.segments.map(segment => Object.freeze({
      claimId: segment.claimId,
      works: Object.freeze(segment.works.map(projectCrossBookWork)),
    }))),
  });
}

/**
 * Reduce a trusted, progress-checked presentation to the exact metadata the
 * UI renders. This is intentionally a one-way projection: locator IDs,
 * unlock thresholds, raw evidence IDs and provider claim envelopes are not
 * retained in React message state.
 *
 * A mismatched segment/layout pair is rejected rather than partially shown.
 */
export function projectHoidAnswerForDisplay(
  presentation: Extract<HoidAnswerPresentation, { status: "ready" }>,
): HoidAnswerDisplayProjection | null {
  const hasSegments = presentation.segments !== undefined;
  const hasLayout = presentation.layout !== undefined;
  if (hasSegments !== hasLayout) return null;
  if (presentation.segments && presentation.segments.length === 0) return null;

  const citations = Object.freeze(presentation.citations.map(projectCitation));
  const segments = presentation.segments
    ? Object.freeze(presentation.segments.map(segment => Object.freeze({
        claimId: segment.claimId,
        text: segment.text,
        citations: Object.freeze(segment.citations.map(projectCitation)),
      })))
    : undefined;

  return Object.freeze({
    text: presentation.text,
    citations,
    ...(segments && presentation.layout
      ? { segments, layout: presentation.layout }
      : {}),
  });
}
