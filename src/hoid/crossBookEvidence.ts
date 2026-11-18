import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import {
  presentHoidEvidenceAnswer,
  type HoidPresentedCitation,
} from "./answerPresentation";
import type { HoidEvidenceAnswer } from "./evidenceRuntime";

export type HoidCrossBookWorkEvidence = Readonly<{
  sourceBookId: string;
  title: string;
  chapters: readonly number[];
  evidenceIds: readonly string[];
}>;

export type HoidCrossBookSegmentEvidence = Readonly<{
  claimId: string;
  sourceBookIds: readonly string[];
}>;

export type HoidCrossBookEvidenceSummary = Readonly<{
  workCount: number;
  works: readonly HoidCrossBookWorkEvidence[];
  segments: readonly HoidCrossBookSegmentEvidence[];
}>;

export type HoidCrossBookEvidenceResult =
  | Readonly<{ status: "ready"; summary: HoidCrossBookEvidenceSummary }>
  | Readonly<{ status: "not-cross-book" }>
  | Readonly<{
      status: "unavailable";
      reason: "answer-not-authorized" | "segment-provenance-required" | "invalid-provenance";
    }>;

const WORK_ORDER = new Map(HOID_SOURCE_BIBLIOGRAPHY.map((work, index) => [work.id, index]));

/**
 * Builds a metadata-only work matrix from the final presentation boundary.
 * The answer is revalidated against the supplied live progress snapshot first;
 * each source therefore retains its own work-local unlock requirement.
 */
export function buildHoidCrossBookEvidenceSummary(
  answer: HoidEvidenceAnswer | unknown,
  progress: unknown,
): HoidCrossBookEvidenceResult {
  const presentation = presentHoidEvidenceAnswer(answer, progress);
  if (presentation.status !== "ready") {
    return Object.freeze({ status: "unavailable", reason: "answer-not-authorized" });
  }
  if (!presentation.segments || !presentation.layout) {
    return Object.freeze({ status: "unavailable", reason: "segment-provenance-required" });
  }

  const globalById = new Map<string, HoidPresentedCitation>();
  for (const citation of presentation.citations) {
    if (
      globalById.has(citation.evidenceId) ||
      WORK_ORDER.get(citation.sourceBookId) === undefined ||
      HOID_SOURCE_BIBLIOGRAPHY[WORK_ORDER.get(citation.sourceBookId)!]?.title !== citation.title
    ) return Object.freeze({ status: "unavailable", reason: "invalid-provenance" });
    globalById.set(citation.evidenceId, citation);
  }

  const referenced = new Set<string>();
  const workEvidence = new Map<string, { title: string; chapters: Set<number>; evidenceIds: Set<string> }>();
  const segmentEvidence: HoidCrossBookSegmentEvidence[] = [];

  for (const segment of presentation.segments) {
    if (
      !segment.claimId ||
      !segment.text ||
      segment.evidenceIds.length !== segment.citations.length ||
      segment.evidenceIds.length === 0
    ) return Object.freeze({ status: "unavailable", reason: "invalid-provenance" });

    const segmentWorkIds = new Set<string>();
    const segmentSeen = new Set<string>();
    for (const citation of segment.citations) {
      const global = globalById.get(citation.evidenceId);
      if (
        !global ||
        segmentSeen.has(citation.evidenceId) ||
        global.sourceBookId !== citation.sourceBookId ||
        global.title !== citation.title ||
        global.chapter !== citation.chapter ||
        global.locatorId !== citation.locatorId
      ) return Object.freeze({ status: "unavailable", reason: "invalid-provenance" });
      segmentSeen.add(citation.evidenceId);
      referenced.add(citation.evidenceId);
      segmentWorkIds.add(citation.sourceBookId);

      let group = workEvidence.get(citation.sourceBookId);
      if (!group) {
        group = { title: citation.title, chapters: new Set<number>(), evidenceIds: new Set<string>() };
        workEvidence.set(citation.sourceBookId, group);
      }
      group.chapters.add(citation.chapter);
      group.evidenceIds.add(citation.evidenceId);
    }

    if (
      segmentSeen.size !== segment.evidenceIds.length ||
      segment.evidenceIds.some(id => !segmentSeen.has(id))
    ) return Object.freeze({ status: "unavailable", reason: "invalid-provenance" });

    const sourceBookIds = [...segmentWorkIds].sort(
      (left, right) => WORK_ORDER.get(left)! - WORK_ORDER.get(right)!,
    );
    segmentEvidence.push(Object.freeze({
      claimId: segment.claimId,
      sourceBookIds: Object.freeze(sourceBookIds),
    }));
  }

  if (
    referenced.size !== globalById.size ||
    [...globalById.keys()].some(id => !referenced.has(id))
  ) return Object.freeze({ status: "unavailable", reason: "invalid-provenance" });

  if (workEvidence.size < 2) return Object.freeze({ status: "not-cross-book" });

  const works = [...workEvidence.entries()]
    .sort(([left], [right]) => WORK_ORDER.get(left)! - WORK_ORDER.get(right)!)
    .map(([sourceBookId, group]) => Object.freeze({
      sourceBookId,
      title: group.title,
      chapters: Object.freeze([...group.chapters].sort((left, right) => left - right)),
      evidenceIds: Object.freeze([...group.evidenceIds].sort()),
    }));

  return Object.freeze({
    status: "ready",
    summary: Object.freeze({
      workCount: works.length,
      works: Object.freeze(works),
      segments: Object.freeze(segmentEvidence),
    }),
  });
}
