import { describe, expect, it } from "vitest";
import { sha256Hex } from "./sha256";
import {
  HOID_APPROVED_TOPIC_ASSIGNMENTS,
  HOID_TOPIC_TAXONOMY,
  validateHoidTopicAssignments,
} from "./topicTaxonomy";

function assignment(overrides: Record<string, unknown> = {}) {
  const text = "Dato sintético para probar una asignación editorial.";
  return {
    schemaVersion: 1,
    id: "topic-assignment.alpha",
    subjectKind: "work",
    subjectId: "tfe",
    worldId: "world-alpha",
    worldLabel: "Mundo Alfa",
    topicId: "investiture-system",
    dimensionId: "mechanism",
    claimId: "claim.alpha",
    claimTextSha256: sha256Hex(text),
    evidenceIds: ["evidence.alpha"],
    review: {
      status: "approved",
      reviewerId: "reviewer-1",
      reviewedAt: "2026-11-18T10:00:00.000Z",
    },
    ...overrides,
  };
}

describe("Hoid reviewed topic taxonomy", () => {
  it("exposes a closed taxonomy with dimensions scoped to each topic", () => {
    expect(HOID_TOPIC_TAXONOMY.map(topic => topic.id)).toContain("investiture-system");
    expect(HOID_TOPIC_TAXONOMY.find(topic => topic.id === "investiture-system")?.dimensions.map(item => item.id))
      .toEqual(["mechanism", "source", "access-condition", "manifestation", "limitation"]);
    expect(validateHoidTopicAssignments([])).toEqual({ status: "valid", assignments: [] });
  });

  it("keeps the production assignment registry empty until independently reviewed records exist", () => {
    expect(HOID_APPROVED_TOPIC_ASSIGNMENTS).toEqual([]);
  });

  it("accepts an exact, source-controlled approved work assignment", () => {
    const result = validateHoidTopicAssignments([assignment()]);
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].claimTextSha256).toBe(sha256Hex("Dato sintético para probar una asignación editorial."));
  });

  it("accepts only bibliography works or entities already in the approved identity registry", () => {
    expect(validateHoidTopicAssignments([assignment({ subjectKind: "work", subjectId: "tfe" })]).status).toBe("valid");
    expect(validateHoidTopicAssignments([assignment({ subjectKind: "work", subjectId: "unknown-work" })]).status).toBe("invalid");
    expect(validateHoidTopicAssignments([assignment({ subjectKind: "entity", subjectId: "entity.not-approved" })]).status).toBe("invalid");
  });

  it("rejects dimensions that do not belong to the selected topic", () => {
    expect(validateHoidTopicAssignments([assignment({
      topicId: "investiture-system",
      dimensionId: "membership",
    })]).status).toBe("invalid");
  });

  it("rejects duplicate assignments for the same subject and dimension", () => {
    expect(validateHoidTopicAssignments([
      assignment({ id: "assignment.one" }),
      assignment({ id: "assignment.two" }),
    ])).toEqual({ status: "invalid", reason: "duplicate-assignment" });
  });

  it("rejects conflicting labels for one canonical world identity", () => {
    expect(validateHoidTopicAssignments([
      assignment(),
      assignment({
        id: "topic-assignment.beta",
        subjectId: "wor",
        claimId: "claim.beta",
        worldLabel: "Etiqueta contradictoria",
      }),
    ])).toEqual({ status: "invalid", reason: "inconsistent-world-label" });
  });

  it("rejects malformed review metadata, hashes, duplicate evidence and unknown fields", () => {
    expect(validateHoidTopicAssignments([assignment({
      review: { status: "approved", reviewerId: "reviewer-1", reviewedAt: "yesterday" },
    })]).status).toBe("invalid");
    expect(validateHoidTopicAssignments([assignment({ claimTextSha256: "abc" })]).status).toBe("invalid");
    expect(validateHoidTopicAssignments([assignment({ evidenceIds: ["evidence.alpha", "evidence.alpha"] })]).status).toBe("invalid");
    expect(validateHoidTopicAssignments([assignment({ unreviewedExtra: true })]).status).toBe("invalid");
  });

  it("rejects accessors and sparse assignment arrays without invoking getters", () => {
    let invoked = false;
    const accessor = Object.defineProperty({}, "schemaVersion", {
      enumerable: true,
      get() { invoked = true; return 1; },
    });
    expect(validateHoidTopicAssignments([accessor]).status).toBe("invalid");
    expect(invoked).toBe(false);
    const sparse = new Array(1);
    expect(validateHoidTopicAssignments(sparse)).toEqual({ status: "invalid", reason: "invalid-batch" });
  });
});
