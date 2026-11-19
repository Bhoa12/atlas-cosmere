import { describe, expect, it, vi } from "vitest";
import {
  createHoidEvidenceRuntime,
  type HoidApprovedClaim,
  type HoidClaimSelectionRequest,
} from "./evidenceRuntime";
import type { HoidKnowledgeEntry } from "./catalog";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";
import { presentHoidEvidenceAnswer } from "./answerPresentation";
import { createHoidApprovedClaimAnswerPort } from "./topicApprovedClaimAnswerPort";
import { composeHoidTopicRecommendations } from "./topicRecommendations";
import { sha256Hex } from "./sha256";
import { createHoidApprovedClaimAttestation, type HoidApprovedClaimCore } from "./approvedClaimIntegrity";

const UPDATED_AT = "2026-11-18T19:00:00.000Z";

function locator(bookId: string, chapter: number): string {
  const result = getHoidReadingManifest(bookId);
  if (result.status !== "ready") throw new Error("Synthetic manifest unavailable");
  const unit = result.manifest.units.find(item => item.chapterNumber === chapter);
  if (!unit?.locatorId) throw new Error("Synthetic locator unavailable");
  return unit.locatorId;
}

function cursor(bookId: string, chapter: number) {
  const result = createHoidReadingCursor(bookId, chapter);
  if (result.status !== "ready") throw new Error("Synthetic cursor unavailable");
  return result.cursor;
}

function progress(positions: readonly Readonly<{ bookId: string; chapter: number }>[]) {
  const projected = positions.map(position => ({
    bookId: position.bookId,
    cursor: cursor(position.bookId, position.chapter),
  }));
  return {
    schemaVersion: 2,
    revision: projected.length === 0 ? 0 : 1,
    positions: projected,
    updatedAt: projected.length === 0 ? null : UPDATED_AT,
  };
}

const knowledge: HoidKnowledgeEntry[] = [
  {
    id: "e-alpha",
    aliases: ["Synthetic Alpha"],
    kind: "concept",
    firstSafeAppearance: { bookId: "twok", chapter: 1 },
    evidenceSource: { bookId: "twok", chapter: 1, locatorId: locator("twok", 1) },
    evidenceUnlock: { bookId: "twok", chapter: 2 },
    provenance: "verified",
    summary: "Original synthetic editorial summary for test coverage.",
  },
  {
    id: "e-beta",
    aliases: ["Synthetic Beta"],
    kind: "phenomenon",
    firstSafeAppearance: { bookId: "tfe", chapter: 1 },
    evidenceSource: { bookId: "tfe", chapter: 1, locatorId: locator("tfe", 1) },
    evidenceUnlock: { bookId: "tfe", chapter: 2 },
    provenance: "verified",
    summary: "Second original synthetic editorial summary for test coverage.",
  },
];

const reviewer = Object.freeze({
  reviewerId: "synthetic-editor",
  reviewedAt: "2026-11-18T18:00:00.000Z",
});

function approvedClaim(core: HoidApprovedClaimCore): HoidApprovedClaim {
  const attestation = createHoidApprovedClaimAttestation(core, knowledge, reviewer);
  if (attestation.status !== "valid") throw new Error("Topic answer fixture claim attestation failed: " + attestation.reason);
  return Object.freeze({ ...core, integrity: attestation.integrity, review: attestation.review });
}

const claims: HoidApprovedClaim[] = [
  approvedClaim({
    id: "claim-topic",
    text: "An original synthetic recommendation reason backed by one approved source.",
    intent: "recommend",
    evidenceIds: ["e-alpha"],
  }),
  approvedClaim({
    id: "claim-cross-book",
    text: "An original synthetic recommendation reason requiring both source works.",
    intent: "recommend",
    evidenceIds: ["e-alpha", "e-beta"],
  }),
  approvedClaim({
    id: "claim-explain",
    text: "An explanation claim must not be rendered through the recommendation port.",
    intent: "explain",
    evidenceIds: ["e-alpha"],
  }),
];

function createPort(selector = vi.fn(async (_request: HoidClaimSelectionRequest) => [])) {
  const runtime = createHoidEvidenceRuntime({
    knowledge,
    claims,
    selector: { selectClaims: selector },
  });
  if (!runtime) throw new Error("Synthetic evidence runtime unavailable");
  const port = createHoidApprovedClaimAnswerPort(runtime);
  if (!port) throw new Error("Local approved-claim port unavailable");
  return { port, selector };
}

function assignment(
  claimId: string,
  text: string,
  evidenceIds: readonly string[],
) {
  return {
    schemaVersion: 1,
    id: "assignment.elantris.investiture." + claimId,
    subjectKind: "work",
    subjectId: "elantris",
    worldId: "world-alpha",
    worldLabel: "Mundo Alfa",
    topicId: "investiture-system",
    dimensionId: "mechanism",
    claimId,
    claimTextSha256: sha256Hex(text),
    evidenceIds: [...evidenceIds],
    review: {
      status: "approved",
      reviewerId: "synthetic-editor",
      reviewedAt: "2026-11-18T18:00:00.000Z",
    },
  };
}

function approvedClaims() {
  return claims.map(claim => ({
    id: claim.id,
    text: claim.text,
    evidenceIds: claim.evidenceIds,
  }));
}

function approvedKnowledge() {
  return knowledge.map(entry => ({
    id: entry.id,
    kind: entry.kind,
    provenance: entry.provenance,
    summary: entry.summary,
    evidenceSource: entry.evidenceSource,
    evidenceUnlock: entry.evidenceUnlock,
    firstSafeAppearance: entry.firstSafeAppearance,
  }));
}

describe("Hoid local approved-claim answer port", () => {
  it("projects a v2 cursor snapshot, renders exact approved text and presents its citation without invoking a selector", () => {
    const { port, selector } = createPort();
    const snapshot = progress([{ bookId: "twok", chapter: 3 }]);
    const result = port(["claim-topic"], snapshot);

    expect(result).toHaveLength(1);
    expect(result[0].claimId).toBe("claim-topic");
    expect(result[0].answer).toMatchObject({
      status: "authorized",
      text: claims[0].text,
      claimIds: ["claim-topic"],
      evidenceIds: ["e-alpha"],
      layout: "plain",
      segments: [{
        claimId: "claim-topic",
        text: claims[0].text,
        evidenceIds: ["e-alpha"],
      }],
    });
    expect(result[0].answer.sources).toEqual([{
      evidenceId: "e-alpha",
      sourceBookId: "twok",
      sourceChapter: 1,
      locatorId: locator("twok", 1),
      unlockBookId: "twok",
      unlockChapter: 2,
    }]);

    const presented = presentHoidEvidenceAnswer(result[0].answer, snapshot);
    expect(presented.status).toBe("ready");
    if (presented.status === "ready") {
      expect(presented.segments).toHaveLength(1);
      expect(presented.segments?.[0].claimId).toBe("claim-topic");
      expect(presented.segments?.[0].citations[0].evidenceId).toBe("e-alpha");
    }
    expect(selector).not.toHaveBeenCalled();
  });

  it("does not treat the currently open unlock chapter as completed", () => {
    const { port } = createPort();
    expect(port(["claim-topic"], progress([{ bookId: "twok", chapter: 2 }]))).toEqual([]);
    expect(port(["claim-topic"], progress([{ bookId: "twok", chapter: 3 }]))).toHaveLength(1);
  });

  it("requires every cross-book evidence item to be unlocked independently", () => {
    const { port } = createPort();
    const lockedSnapshot = progress([
      { bookId: "twok", chapter: 3 },
      { bookId: "tfe", chapter: 2 },
    ]);
    expect(port(["claim-cross-book"], lockedSnapshot)).toEqual([]);

    const unlockedSnapshot = progress([
      { bookId: "twok", chapter: 3 },
      { bookId: "tfe", chapter: 3 },
    ]);
    const authorized = port(["claim-cross-book"], unlockedSnapshot);
    expect(authorized).toHaveLength(1);
    expect(authorized[0].answer.evidenceIds).toEqual(["e-alpha", "e-beta"]);
    expect(authorized[0].answer.sources.map(source => source.sourceBookId)).toEqual(["twok", "tfe"]);
    expect(presentHoidEvidenceAnswer(authorized[0].answer, unlockedSnapshot).status).toBe("ready");
  });

  it("does not render claims with an intent other than recommend", () => {
    const { port } = createPort();
    expect(port(["claim-explain"], progress([{ bookId: "twok", chapter: 3 }]))).toEqual([]);
  });

  it("rejects duplicate, sparse and malformed claim ID batches", () => {
    const { port } = createPort();
    const snapshot = progress([{ bookId: "twok", chapter: 3 }]);
    expect(port(["claim-topic", "claim-topic"], snapshot)).toEqual([]);
    expect(port(["claim topic"], snapshot)).toEqual([]);
    const sparse = new Array(1) as unknown as readonly string[];
    expect(port(sparse, snapshot)).toEqual([]);
  });

  it("rejects malformed or stale-edition cursor snapshots before rendering", () => {
    const { port } = createPort();
    const malformed = { ...progress([{ bookId: "twok", chapter: 3 }]), extra: true };
    expect(port(["claim-topic"], malformed)).toEqual([]);
    expect(port(["claim-topic"], null)).toEqual([]);
  });

  it("composes an end-to-end topic recommendation from the cursor-native local answer port", () => {
    const { port } = createPort();
    const snapshot = progress([{ bookId: "twok", chapter: 3 }]);
    const answers = port(["claim-topic"], snapshot);
    const text = claims[0].text;
    const result = composeHoidTopicRecommendations(
      ["investiture-system"],
      snapshot,
      answers,
      5,
      [assignment("claim-topic", text, ["e-alpha"])],
      approvedClaims(),
      approvedKnowledge(),
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.items).toHaveLength(1);
    expect(result.items[0].sourceId).toBe("elantris");
    expect(result.items[0].matches[0].reasonText).toBe(text);
    expect(result.items[0].matches[0].citations.map(citation => citation.evidenceId)).toEqual(["e-alpha"]);
  });

  it("withholds a cross-book topic recommendation until every source cursor is beyond its unlock boundary", () => {
    const { port } = createPort();
    const text = claims[1].text;
    const targetAssignment = assignment("claim-cross-book", text, ["e-alpha", "e-beta"]);

    const lockedSnapshot = progress([
      { bookId: "twok", chapter: 3 },
      { bookId: "tfe", chapter: 2 },
    ]);
    const locked = composeHoidTopicRecommendations(
      ["investiture-system"],
      lockedSnapshot,
      port(["claim-cross-book"], lockedSnapshot),
      5,
      [targetAssignment],
      approvedClaims(),
      approvedKnowledge(),
    );
    expect(locked).toEqual({ status: "none", reason: "no-safe-reviewed-matches" });

    const unlockedSnapshot = progress([
      { bookId: "twok", chapter: 3 },
      { bookId: "tfe", chapter: 3 },
    ]);
    const unlocked = composeHoidTopicRecommendations(
      ["investiture-system"],
      unlockedSnapshot,
      port(["claim-cross-book"], unlockedSnapshot),
      5,
      [targetAssignment],
      approvedClaims(),
      approvedKnowledge(),
    );
    expect(unlocked.status).toBe("ready");
    if (unlocked.status !== "ready") return;
    expect(unlocked.items[0].matches[0].citations.map(citation => citation.sourceBookId)).toEqual(["tfe", "twok"]);
  });

  it("returns no port when the editorial runtime is unavailable", () => {
    expect(createHoidApprovedClaimAnswerPort(null)).toBeUndefined();
  });
});
