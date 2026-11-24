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
import { resolveHoidChapterIdentity } from "./chapterIdentity";

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
  /** Stable numbered-unit ordinal; distinguishes repeated visible chapter labels. */
  chapterOrdinal: number;
  chapterLabelAmbiguous: boolean;
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

function projectCitation(citation: HoidPresentedCitation): HoidDisplayCitation | null {
  const identity = resolveHoidChapterIdentity(citation.sourceBookId, {
    chapterNumber: citation.chapter,
    locatorId: citation.locatorId,
  });
  if (identity.status !== "resolved") return null;
  const labelResolution = resolveHoidChapterIdentity(citation.sourceBookId, {
    chapterNumber: citation.chapter,
  });
  if (labelResolution.status === "unavailable") return null;
  return Object.freeze({
    sourceBookId: citation.sourceBookId,
    title: citation.title,
    chapter: citation.chapter,
    chapterOrdinal: identity.identity.ordinal,
    chapterLabelAmbiguous: labelResolution.status === "ambiguous",
  });
}

function projectCitationList(
  citations: readonly HoidPresentedCitation[],
): readonly HoidDisplayCitation[] | null {
  const projected: HoidDisplayCitation[] = [];
  for (const citation of citations) {
    const item = projectCitation(citation);
    if (!item) return null;
    projected.push(item);
  }
  return Object.freeze(projected);
}

function projectCrossBookWork(
  work: HoidCrossBookWorkEvidence | HoidCrossBookSegmentWorkEvidence,
): HoidDisplayCrossBookWorkEvidence | null {
  for (const chapter of work.chapters) {
    if (resolveHoidChapterIdentity(work.sourceBookId, { chapterNumber: chapter }).status !== "resolved") {
      return null;
    }
  }
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

  const works = summary.works.map(projectCrossBookWork);
  if (works.some(work => work === null)) return null;
  const segments = summary.segments.map(segment => {
    const segmentWorks = segment.works.map(projectCrossBookWork);
    if (segmentWorks.some(work => work === null)) return null;
    return Object.freeze({
      claimId: segment.claimId,
      works: Object.freeze(segmentWorks as HoidDisplayCrossBookWorkEvidence[]),
    });
  });
  if (segments.some(segment => segment === null)) return null;

  return Object.freeze({
    workCount: summary.workCount,
    works: Object.freeze(works as HoidDisplayCrossBookWorkEvidence[]),
    segments: Object.freeze(segments as HoidDisplayCrossBookSegmentEvidence[]),
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

  const citations = projectCitationList(presentation.citations);
  if (!citations) return null;
  let segments: readonly HoidDisplaySegment[] | undefined;
  if (presentation.segments) {
    const projectedSegments: HoidDisplaySegment[] = [];
    for (const segment of presentation.segments) {
      const segmentCitations = projectCitationList(segment.citations);
      if (!segmentCitations) return null;
      projectedSegments.push(Object.freeze({
        claimId: segment.claimId,
        text: segment.text,
        citations: segmentCitations,
      }));
    }
    segments = Object.freeze(projectedSegments);
  }

  return Object.freeze({
    text: presentation.text,
    citations,
    ...(segments && presentation.layout
      ? { segments, layout: presentation.layout }
      : {}),
  });
}
