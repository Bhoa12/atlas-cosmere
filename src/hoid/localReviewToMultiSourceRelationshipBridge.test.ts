import { describe, expect, it } from "vitest";
import {
  buildHoidHistoricalEditorialReviewPacket,
  validateHoidHistoricalEditorialReviewDecision,
  type HoidHistoricalEditorialReviewPacket,
} from "./historicalEditorialReview";
import {
  createHoidReadingCursor,
  getHoidReadingManifest,
} from "./readingManifest";
import {
  getVerifiedChapterDocumentSha256,
} from "./verifiedChapterDocuments";
import { sha256Hex } from "./sha256";
import {
  createHoidEditorialEntityDraft,
} from "./editorialEntityDrafts";
import {
  evaluateHoidEditorialRelationshipDrafts,
} from "./editorialRelationshipDrafts";
import {
  buildHoidLocalReviewMultiSourceAtomicClaimCandidate,
  type HoidLocalMultiSourceAtomicClaimInput,
  type HoidLocalMultiSourceReviewInput,
} from "./localReviewToMultiSourceAtomicClaimBridge";
import {
  buildHoidLocalReviewMultiSourceRelationshipCandidate,
  type HoidLocalMultiSourceRelationshipInput,
} from "./localReviewToMultiSourceRelationshipBridge";
import type { HoidEditorialClaimEvidence } from "./editorialClaimDrafts";

const REVIEWED_AT = "2026-11-26T22:00:00.000Z";
const SUMMARY =
  "Resumen original sintético para probar la composición de relaciones entre obras. No contiene texto del EPUB ni afirma hechos narrativos reales.";
const STATEMENT =
  "Relación sintética entre dos entidades de prueba respaldada por dos capítulos inspeccionados de obras distintas.";
const SEED_CLAIM: HoidLocalMultiSourceAtomicClaimInput = Object.freeze({
  subjectId: "synthetic.subject",
  subjectKind: "character",
  assertionKind: "relationship",
  intent: "context",
  statement: STATEMENT,
});

function sourcePacket(
  workId: string,
  chapterNumber = 1,
): HoidHistoricalEditorialReviewPacket {
  const manifestResult = getHoidReadingManifest(workId);
  if (manifestResult.status !== "ready") {
    throw new Error("Expected a verified test manifest");
  }
  const manifest = manifestResult.manifest;
  const documentSha256 = getVerifiedChapterDocumentSha256(
    workId,
    manifest.editionId,
    manifest.navigationSha256,
    chapterNumber,
  );
  if (!documentSha256) throw new Error("Expected an inspected chapter fixture");

  const result = buildHoidHistoricalEditorialReviewPacket(
    Object.freeze({
      schemaVersion: 1,
      scope: "ephemeral-local-editorial-draft",
      workId,
      editionId: manifest.editionId,
      chapterNumber,
      summaryText: SUMMARY,
      originalityAttested: true,
      reviewState: "awaiting-human-editorial-review",
      sourceContentIncluded: false,
      sourceTextPersisted: false,
      productionWritePerformed: false,
      authorizationEffect: "none",
      editorialEffect: "none",
      spoilerAuthorization: "none",
    }),
    Object.freeze({
      receiptFingerprint: sha256Hex("relationship-source-" + workId + "-" + chapterNumber),
      documentSha256,
      navigationSha256: manifest.navigationSha256,
      byteLength: 512,
      inspectedAt: "2026-11-26T21:45:00.000Z",
    }),
  );
  if (result.status !== "ready") {
    throw new Error("Expected a valid historical review packet");
  }
  return result.packet;
}

function reviewReceipt(
  packet: HoidHistoricalEditorialReviewPacket,
  decision: "approved" | "revision-required" | "rejected" = "approved",
) {
  const checklist = decision === "approved"
    ? Object.freeze({
        factualAccuracy: true,
        completeness: true,
        originality: true,
        spoilerCeiling: true,
        provenance: true,
      })
    : Object.freeze({
        factualAccuracy: false,
        completeness: true,
        originality: true,
        spoilerCeiling: true,
        provenance: true,
      });
  const result = validateHoidHistoricalEditorialReviewDecision(packet, Object.freeze({
    decision,
    reviewerLabel: "local-reviewer",
    reviewedAt: REVIEWED_AT,
    checklist,
    noteCodes: decision === "approved"
      ? Object.freeze(["no-issues"])
      : Object.freeze(["factual-issue"]),
  }));
  if (result.status !== "valid") throw new Error("Expected a valid local review receipt");
  return result.receipt;
}

function validSources(): readonly HoidLocalMultiSourceReviewInput[] {
  const tfe = sourcePacket("tfe", 1);
  const twok = sourcePacket("twok", 1);
  return Object.freeze([
    Object.freeze({ packet: tfe, receipt: reviewReceipt(tfe) }),
    Object.freeze({ packet: twok, receipt: reviewReceipt(twok) }),
  ]);
}

function createEntity(
  id: string,
  canonicalLabel: string,
  evidence: readonly HoidEditorialClaimEvidence[],
) {
  const result = createHoidEditorialEntityDraft({
    id,
    kind: "character",
    identity: { status: "resolved", canonicalLabel },
    evidence,
  });
  if (result.status !== "valid") throw new Error("Expected a valid entity identity draft");
  return result.draft;
}

function fixtures() {
  const sources = validSources();
  const seed = buildHoidLocalReviewMultiSourceAtomicClaimCandidate(sources, SEED_CLAIM);
  if (seed.status !== "ready") throw new Error("Expected a valid multi-source seed");
  const tfeEvidence = seed.candidate.claimDraft.evidence.find(
    item => item.source.bookId === "tfe",
  );
  const twokEvidence = seed.candidate.claimDraft.evidence.find(
    item => item.source.bookId === "twok",
  );
  if (!tfeEvidence || !twokEvidence) throw new Error("Expected both work evidences");
  const subjectDraft = createEntity("synthetic.subject", "Entidad sintética A", [tfeEvidence]);
  const objectDraft = createEntity("synthetic.object", "Entidad sintética B", [twokEvidence]);
  const relationshipInput: HoidLocalMultiSourceRelationshipInput = Object.freeze({
    predicate: "related-to",
    subjectDraft,
    objectDraft,
    intent: "context",
    statement: STATEMENT,
  });
  return { sources, subjectDraft, objectDraft, relationshipInput };
}

function progress(
  positions: Array<{ bookId: string; chapter?: number; completed?: boolean }>,
) {
  const canonical = positions.map(position => {
    if (position.completed === true) {
      return { bookId: position.bookId, completed: true as const };
    }
    const cursor = createHoidReadingCursor(position.bookId, position.chapter);
    if (cursor.status !== "ready") throw new Error("Expected a valid progress cursor");
    return { bookId: position.bookId, cursor: cursor.cursor };
  });
  return Object.freeze({
    schemaVersion: 2,
    revision: canonical.length === 0 ? 0 : 1,
    positions: Object.freeze(canonical),
    updatedAt: canonical.length === 0 ? null : REVIEWED_AT,
  });
}

describe("Hoid local multi-source relationship bridge", () => {
  it("builds a relationship draft and review packet from two locally approved works", () => {
    const fixture = fixtures();
    const result = buildHoidLocalReviewMultiSourceRelationshipCandidate(
      fixture.sources,
      fixture.relationshipInput,
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    expect(result.candidate.sourceCount).toBe(2);
    expect(result.candidate.distinctWorkCount).toBe(2);
    expect(result.candidate.sourceReviewTrust).toBe("local-unverified");
    expect(result.candidate.stage).toBe("awaiting-independent-relationship-review");
    expect(result.candidate.relationshipDraft.evidence).toHaveLength(2);
    expect(result.candidate.relationshipDraft.relationEvidenceIndices).toEqual([0, 1]);
    expect(result.candidate.relationshipDraft.subject.evidenceIndices).toHaveLength(1);
    expect(result.candidate.relationshipDraft.object.evidenceIndices).toHaveLength(1);
    expect(result.candidate.relationshipReviewPacket.status).toBe("pending-review");
    expect(result.candidate.relationshipReviewPacket.statement).toBe(STATEMENT);
    expect(result.candidate.promotionAllowed).toBe(false);
    expect(result.candidate.productionWritePerformed).toBe(false);
  });

  it("withholds the relation until every source chapter is completed", () => {
    const fixture = fixtures();
    const result = buildHoidLocalReviewMultiSourceRelationshipCandidate(
      fixture.sources,
      fixture.relationshipInput,
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    const partial = evaluateHoidEditorialRelationshipDrafts(
      [result.candidate.relationshipDraft],
      progress([{ bookId: "tfe", chapter: 2 }]),
    );
    expect(partial.status).toBe("ready");
    if (partial.status !== "ready") return;
    expect(partial.evaluations[0].status).toBe("withheld");
    if (partial.evaluations[0].status === "withheld") {
      expect(partial.evaluations[0].missingRequirements).toEqual([
        { bookId: "twok", chapter: 1 },
      ]);
    }

    const complete = evaluateHoidEditorialRelationshipDrafts(
      [result.candidate.relationshipDraft],
      progress([
        { bookId: "tfe", chapter: 2 },
        { bookId: "twok", chapter: 2 },
      ]),
    );
    expect(complete.status).toBe("ready");
    if (complete.status === "ready") {
      expect(complete.evaluations[0].status).toBe("eligible-for-review");
    }
  });

  it("does not unlock either source while both chapter-one cursors are still open", () => {
    const fixture = fixtures();
    const result = buildHoidLocalReviewMultiSourceRelationshipCandidate(
      fixture.sources,
      fixture.relationshipInput,
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    const open = evaluateHoidEditorialRelationshipDrafts(
      [result.candidate.relationshipDraft],
      progress([
        { bookId: "tfe", chapter: 1 },
        { bookId: "twok", chapter: 1 },
      ]),
    );
    expect(open.status).toBe("ready");
    if (open.status === "ready") {
      expect(open.evaluations[0]).toMatchObject({
        status: "withheld",
        missingRequirements: [
          { bookId: "tfe", chapter: 1 },
          { bookId: "twok", chapter: 1 },
        ],
      });
    }
  });

  it("is deterministic when the source reviews are supplied in reverse order", () => {
    const fixture = fixtures();
    const forward = buildHoidLocalReviewMultiSourceRelationshipCandidate(
      fixture.sources,
      fixture.relationshipInput,
    );
    const reverse = buildHoidLocalReviewMultiSourceRelationshipCandidate(
      [...fixture.sources].reverse(),
      fixture.relationshipInput,
    );
    expect(forward.status).toBe("ready");
    expect(reverse.status).toBe("ready");
    if (forward.status !== "ready" || reverse.status !== "ready") return;
    expect(forward.candidate.candidateId).toBe(reverse.candidate.candidateId);
    expect(forward.candidate.relationshipDraft.integrity.claimSha256).toBe(
      reverse.candidate.relationshipDraft.integrity.claimSha256,
    );
  });

  it("rejects an unresolved entity identity", () => {
    const fixture = fixtures();
    const unresolved = createHoidEditorialEntityDraft({
      id: "synthetic.unresolved",
      kind: "character",
      identity: { status: "unresolved", issueCode: "identity-not-established" },
      evidence: fixture.subjectDraft.evidence,
    });
    expect(unresolved.status).toBe("valid");
    if (unresolved.status !== "valid") return;

    expect(buildHoidLocalReviewMultiSourceRelationshipCandidate(
      fixture.sources,
      { ...fixture.relationshipInput, subjectDraft: unresolved.draft },
    )).toMatchObject({ status: "invalid", reason: "unresolved-participant" });
  });

  it("rejects participant evidence that is not part of the reviewed relationship source set", () => {
    const fixture = fixtures();
    const manifest = getHoidReadingManifest("tfe");
    if (manifest.status !== "ready") throw new Error("Expected TFE manifest");
    const unit = manifest.manifest.units.find(item => item.chapterNumber === 2);
    const digest = getVerifiedChapterDocumentSha256(
      "tfe",
      manifest.manifest.editionId,
      manifest.manifest.navigationSha256,
      2,
    );
    if (!unit?.locatorId || !digest) throw new Error("Expected TFE chapter-two evidence");
    const outside = createEntity("synthetic.outside", "Entidad fuera de la revisión", [{
      source: { bookId: "tfe", chapter: 2, locatorId: unit.locatorId },
      unlock: { bookId: "tfe", chapter: 2 },
      sourceIntegrity: {
        editionId: manifest.manifest.editionId,
        navigationSha256: manifest.manifest.navigationSha256,
        documentSha256: digest,
      },
    }]);

    expect(buildHoidLocalReviewMultiSourceRelationshipCandidate(
      fixture.sources,
      { ...fixture.relationshipInput, subjectDraft: outside },
    )).toMatchObject({
      status: "invalid",
      reason: "participant-evidence-not-in-source-set",
    });
  });

  it("rejects a relationship whose two participants are the same entity", () => {
    const fixture = fixtures();
    expect(buildHoidLocalReviewMultiSourceRelationshipCandidate(
      fixture.sources,
      { ...fixture.relationshipInput, objectDraft: fixture.subjectDraft },
    )).toMatchObject({ status: "invalid", reason: "relationship-draft-invalid" });
  });

  it("rejects two chapters from one work as cross-work relationship evidence", () => {
    const first = sourcePacket("tfe", 1);
    const second = sourcePacket("tfe", 2);
    const sources = [
      { packet: first, receipt: reviewReceipt(first) },
      { packet: second, receipt: reviewReceipt(second) },
    ];
    const fixture = fixtures();

    expect(buildHoidLocalReviewMultiSourceRelationshipCandidate(
      sources,
      fixture.relationshipInput,
    )).toMatchObject({ status: "invalid", reason: "multi-source-claim-invalid" });
  });

  it("rejects a source review that has not been locally approved", () => {
    const first = sourcePacket("tfe", 1);
    const second = sourcePacket("twok", 1);
    const sources = [
      { packet: first, receipt: reviewReceipt(first, "revision-required") },
      { packet: second, receipt: reviewReceipt(second) },
    ];
    const fixture = fixtures();

    expect(buildHoidLocalReviewMultiSourceRelationshipCandidate(
      sources,
      fixture.relationshipInput,
    )).toMatchObject({ status: "invalid", reason: "multi-source-claim-invalid" });
  });

  it("does not include chapter summaries, EPUB text, provider output or authorization effects", () => {
    const fixture = fixtures();
    const result = buildHoidLocalReviewMultiSourceRelationshipCandidate(
      fixture.sources,
      fixture.relationshipInput,
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    const serialized = JSON.stringify(result.candidate);
    expect(serialized).not.toContain(SUMMARY);
    expect(serialized).not.toContain("summaryText");
    expect(result.candidate.sourceSummariesIncluded).toBe(false);
    expect(result.candidate.sourceTextIncluded).toBe(false);
    expect(result.candidate.sourceTextPersisted).toBe(false);
    expect(result.candidate.providerEgress).toBe("none");
    expect(result.candidate.authorizationEffect).toBe("none");
    expect(result.candidate.spoilerAuthorization).toBe("none");
  });

  it("rejects extra fields and accessor-backed relationship inputs without invoking getters", () => {
    const fixture = fixtures();
    expect(buildHoidLocalReviewMultiSourceRelationshipCandidate(
      fixture.sources,
      { ...fixture.relationshipInput, extra: true },
    )).toMatchObject({ status: "invalid", reason: "invalid-relationship-input" });

    let getterCalls = 0;
    const accessor = { ...fixture.relationshipInput } as Record<string, unknown>;
    Object.defineProperty(accessor, "statement", {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return STATEMENT;
      },
    });
    expect(buildHoidLocalReviewMultiSourceRelationshipCandidate(
      fixture.sources,
      accessor,
    )).toMatchObject({ status: "invalid", reason: "invalid-relationship-input" });
    expect(getterCalls).toBe(0);
  });
});
