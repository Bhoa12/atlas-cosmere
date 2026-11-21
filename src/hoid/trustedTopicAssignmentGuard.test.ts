import { describe, expect, it } from "vitest";
import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { sha256Hex } from "./sha256";
import { validateHoidTopicRecommendationAssignments } from "./trustedTopicAssignmentGuard";
import type { HoidTopicRecommendation } from "./topicRecommendations";
import type { HoidTopicAssignment } from "./topicTaxonomy";

const CLAIM_ID = "claim-topic-1";
const CLAIM_TEXT = "Afirmación editorial verificada para una recomendación.";
const EVIDENCE_ID = "evidence-topic-1";

function title(bookId: string): string {
  const work = HOID_SOURCE_BIBLIOGRAPHY.find(item => item.id === bookId);
  if (!work) throw new Error("Unknown fixture work");
  return work.title;
}

function citation(evidenceId = EVIDENCE_ID) {
  return Object.freeze({
    evidenceId,
    sourceBookId: "tfe",
    title: title("tfe"),
    chapter: 1,
    locatorId: "tfe.chapter-1",
  });
}

function recommendation(sourceId = "tress"): HoidTopicRecommendation {
  return Object.freeze({
    sourceId,
    title: title(sourceId),
    reason: "reviewed-topic-match",
    matches: Object.freeze([Object.freeze({
      topicId: "investiture-system",
      topicLabel: "Sistema de Investidura",
      dimensionId: "mechanism",
      dimensionLabel: "Mecanismo",
      claimId: CLAIM_ID,
      reasonText: CLAIM_TEXT,
      citations: Object.freeze([citation()]),
    })]),
  });
}

function assignment(overrides?: Partial<HoidTopicAssignment>): HoidTopicAssignment {
  return Object.freeze({
    schemaVersion: 1,
    id: "assignment-topic-tress",
    subjectKind: "work",
    subjectId: "tress",
    worldId: "cosmere",
    worldLabel: "Cosmere",
    topicId: "investiture-system",
    dimensionId: "mechanism",
    claimId: CLAIM_ID,
    claimTextSha256: sha256Hex(CLAIM_TEXT),
    evidenceIds: Object.freeze([EVIDENCE_ID]),
    review: Object.freeze({
      status: "approved",
      reviewerId: "reviewer-test",
      reviewedAt: "2026-11-18T17:00:00.000Z",
    }),
    ...overrides,
  });
}

describe("Hoid trusted topic assignment boundary", () => {
  it("accepts a candidate only when its exact work/topic/dimension/claim tuple is assigned", () => {
    expect(validateHoidTopicRecommendationAssignments(
      [recommendation()],
      [assignment()],
    )).toBe(true);
  });

  it("rejects a candidate work that is not the assignment subject", () => {
    expect(validateHoidTopicRecommendationAssignments(
      [recommendation("yumi")],
      [assignment()],
    )).toBe(false);
  });

  it("rejects a claim digest that differs from the exact displayed text", () => {
    expect(validateHoidTopicRecommendationAssignments(
      [recommendation()],
      [assignment({ claimTextSha256: "0".repeat(64) })],
    )).toBe(false);
  });

  it("rejects evidence IDs that differ from the signed citation set", () => {
    expect(validateHoidTopicRecommendationAssignments(
      [recommendation()],
      [assignment({ evidenceIds: ["other-evidence"] })],
    )).toBe(false);
  });

  it("rejects duplicate assignments for one work/topic/dimension", () => {
    expect(validateHoidTopicRecommendationAssignments(
      [recommendation()],
      [
        assignment(),
        assignment({ id: "assignment-duplicate", claimId: "claim-other" }),
      ],
    )).toBe(false);
  });

  it("rejects an invalid topic dimension", () => {
    expect(validateHoidTopicRecommendationAssignments(
      [recommendation()],
      [assignment({ dimensionId: "not-a-dimension" as HoidTopicAssignment["dimensionId"] })],
    )).toBe(false);
  });

  it("rejects unsorted evidence IDs", () => {
    expect(validateHoidTopicRecommendationAssignments(
      [recommendation()],
      [assignment({ evidenceIds: ["z-evidence", "a-evidence"] })],
    )).toBe(false);
  });

  it("rejects accessors without executing them", () => {
    let invoked = false;
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(hostile, {
      schemaVersion: { enumerable: true, value: 1 },
      id: { enumerable: true, value: "assignment-hostile" },
      subjectKind: { enumerable: true, value: "work" },
      subjectId: { enumerable: true, value: "tress" },
      worldId: { enumerable: true, value: "cosmere" },
      worldLabel: { enumerable: true, value: "Cosmere" },
      topicId: { enumerable: true, value: "investiture-system" },
      dimensionId: { enumerable: true, value: "mechanism" },
      claimId: { enumerable: true, value: CLAIM_ID },
      claimTextSha256: { enumerable: true, value: sha256Hex(CLAIM_TEXT) },
      evidenceIds: { enumerable: true, value: [EVIDENCE_ID] },
      review: { enumerable: true, get: () => { invoked = true; return {}; } },
    });
    expect(validateHoidTopicRecommendationAssignments([recommendation()], [hostile])).toBe(false);
    expect(invoked).toBe(false);
  });

  it("rejects a missing assignment registry", () => {
    expect(validateHoidTopicRecommendationAssignments([recommendation()], [])).toBe(false);
  });
});
