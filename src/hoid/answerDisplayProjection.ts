import type {
  HoidAnswerPresentation,
  HoidPresentedCitation,
} from "./answerPresentation";
import type { HoidNarrativeLayout } from "./narrativeComposition";

/**
 * Minimal citation metadata retained by the chat UI after the trusted
 * presenter has validated the complete evidence record against live progress.
 *
 * Internal EPUB locators and unlock thresholds deliberately do not cross this
 * projection boundary.
 */
export type HoidDisplayCitation = Readonly<{
  evidenceId: string;
  sourceBookId: string;
  title: string;
  chapter: number;
}>;

export type HoidDisplaySegment = Readonly<{
  claimId: string;
  text: string;
  citations: readonly HoidDisplayCitation[];
}>;

export type HoidAnswerDisplayProjection = Readonly<{
  text: string;
  citations: readonly HoidDisplayCitation[];
  layout?: HoidNarrativeLayout;
  segments?: readonly HoidDisplaySegment[];
}>;

function projectCitation(citation: HoidPresentedCitation): HoidDisplayCitation {
  return Object.freeze({
    evidenceId: citation.evidenceId,
    sourceBookId: citation.sourceBookId,
    title: citation.title,
    chapter: citation.chapter,
  });
}

/**
 * Reduce a trusted, progress-checked presentation to the exact metadata the
 * UI renders. This is intentionally a one-way projection: locator IDs,
 * unlock thresholds, raw evidence ID lists and provider claim envelopes are
 * not retained in React message state.
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
