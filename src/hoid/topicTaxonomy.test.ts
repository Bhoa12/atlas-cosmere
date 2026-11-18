import { describe, expect, it } from "vitest";
import { sha256Hex } from "./sha256";
import { getHoidReadingManifest } from "./readingManifest";
import {
  HOID_APPROVED_TOPIC_ASSIGNMENTS,
  HOID_TOPIC_TAXONOMY,
  validateHoidTopicAssignments,
} from "./topicTaxonomy";

const CLAIM_TEXT = "Dato sintético para probar una asignación editorial.";

function locator(bookId: string, chapter: number) {
  const result = getHoidReadingManifest(bookId);
  if (result.status !== "ready") throw new Error("Manifiesto sintético no disponible");
  const unit = result.manifest.units.find(item => item.chapterNumber === chapter);
  if (!unit?.locatorId) throw new Error("Localizador sintético no disponible");
  return unit.locatorId;
}

function validate(records: readonly unknown[]) {
  const claims = new Map<string, { id: string; text: string; evidenceIds: unknown }>();
  const knowledge = new Map<string, Record<string, unknown>>();
  for (const record of records) {
    if (record === null || typeof record !== "object") continue;
    const raw = record as Record<string, unknown>;
    if (typeof raw.claimId === "string") {
      claims.set(raw.claimId, {
        id: raw.claimId,
        text: CLAIM_TEXT,
        evidenceIds: raw.evidenceIds,
      });
    }
    if (Array.isArray(raw.evidenceIds)) {
      for (const evidenceId of raw.evidenceIds) {
        if (typeof evidenceId !== "string") continue;
        knowledge.set(evidenceId, {
          id: evidenceId,
          kind: "concept",
          provenance: "verified",
          summary: CLAIM_TEXT,
          evidenceSource: { bookId: "tfe", chapter: 1, locatorId: locator("tfe", 1) },
          evidenceUnlock: { bookId: "tfe", chapter: 2 },
          firstSafeAppearance: { bookId: "tfe", chapter: 1 },
        });
      }
    }
  }
  return validateHoidTopicAssignments(records, [...claims.values()], [...knowledge.values()]);
}

function assignment(overrides: Record<string, unknown> = {}) {
  const text = CLAIM_TEXT;
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
    const empty = validate([]);
    expect(empty.status).toBe("valid");
    if (empty.status === "valid") {
      expect(empty.assignments).toEqual([]);
      expect(empty.evidenceCitations).toEqual([]);
      expect(empty.entityFirstAppearances).toEqual([]);
    }
  });

  it("rejects evidence whose source chapter has no individually verified document digest", () => {
    const record = assignment();
    const claim = { id: "claim.alpha", text: CLAIM_TEXT, evidenceIds: ["evidence.alpha"] };
    const uninspected = {
      id: "evidence.alpha",
      kind: "concept",
      provenance: "verified",
      summary: CLAIM_TEXT,
      evidenceSource: { bookId: "tfe", chapter: 4, locatorId: locator("tfe", 4) },
      evidenceUnlock: { bookId: "tfe", chapter: 4 },
      firstSafeAppearance: { bookId: "tfe", chapter: 4 },
    };
    expect(validateHoidTopicAssignments([record], [claim], [uninspected]).status).toBe("invalid");
  });

  it("rejects assignments whose approved claim points to evidence absent from the verified source registry", () => {
    const record = assignment();
    const claim = {
      id: "claim.alpha",
      text: CLAIM_TEXT,
      evidenceIds: ["evidence.alpha"],
    };
    expect(validateHoidTopicAssignments([record], [claim], []).status).toBe("invalid");
  });

  it("keeps the production assignment registry empty until independently reviewed records exist", () => {
    expect(HOID_APPROVED_TOPIC_ASSIGNMENTS).toEqual([]);
  });

  it("accepts an exact, source-controlled approved work assignment", () => {
    const result = validate([assignment()]);
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].claimTextSha256).toBe(sha256Hex("Dato sintético para probar una asignación editorial."));
  });

  it("accepts only bibliography works or entities already in the approved identity registry", () => {
    expect(validate([assignment({ subjectKind: "work", subjectId: "tfe" })]).status).toBe("valid");
    expect(validate([assignment({ subjectKind: "work", subjectId: "unknown-work" })]).status).toBe("invalid");
    expect(validate([assignment({ subjectKind: "entity", subjectId: "entity.not-approved" })]).status).toBe("invalid");
  });

  it("rejects dimensions that do not belong to the selected topic", () => {
    expect(validate([assignment({
      topicId: "investiture-system",
      dimensionId: "membership",
    })]).status).toBe("invalid");
  });

  it("rejects duplicate assignments for the same subject and dimension", () => {
    expect(validate([
      assignment({ id: "assignment.one" }),
      assignment({ id: "assignment.two" }),
    ])).toEqual({ status: "invalid", reason: "duplicate-assignment" });
  });

  it("rejects conflicting labels for one world ID and duplicate labels across world IDs", () => {
    expect(validate([
      assignment(),
      assignment({
        id: "topic-assignment.beta",
        subjectId: "wor",
        claimId: "claim.beta",
        worldLabel: "Etiqueta contradictoria",
      }),
    ])).toEqual({ status: "invalid", reason: "inconsistent-world-label" });
    expect(validate([
      assignment(),
      assignment({
        id: "topic-assignment.gamma",
        subjectId: "wor",
        claimId: "claim.beta",
        worldId: "world-beta",
        worldLabel: "Mundo Alfa",
      }),
    ])).toEqual({ status: "invalid", reason: "inconsistent-world-label" });
  });

  it("rejects malformed review metadata, hashes, duplicate evidence and unknown fields", () => {
    expect(validate([assignment({
      review: { status: "approved", reviewerId: "reviewer-1", reviewedAt: "yesterday" },
    })]).status).toBe("invalid");
    expect(validate([assignment({ claimTextSha256: "abc" })]).status).toBe("invalid");
    expect(validate([assignment({ evidenceIds: ["evidence.alpha", "evidence.alpha"] })]).status).toBe("invalid");
    expect(validate([assignment({ unreviewedExtra: true })]).status).toBe("invalid");
  });

  it("rejects accessors and sparse assignment arrays without invoking getters", () => {
    let invoked = false;
    const accessor = Object.defineProperty({}, "schemaVersion", {
      enumerable: true,
      get() { invoked = true; return 1; },
    });
    expect(validate([accessor]).status).toBe("invalid");
    expect(invoked).toBe(false);
    const sparse = new Array(1);
    expect(validate(sparse)).toEqual({ status: "invalid", reason: "invalid-batch" });
  });
});
