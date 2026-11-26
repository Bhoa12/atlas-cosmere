import { describe, expect, it } from "vitest";
import {
  buildHoidHistoricalEditorialReviewPacket,
  validateHoidHistoricalEditorialReviewDecision,
  type HoidHistoricalEditorialReviewPacket,
} from "./historicalEditorialReview";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";
import { sha256Hex } from "./sha256";
import { getVerifiedChapterDocumentSha256 } from "./verifiedChapterDocuments";
import { evaluateHoidEditorialClaimDrafts } from "./editorialClaimDrafts";
import {
  buildHoidLocalReviewMultiSourceAtomicClaimCandidate,
  type HoidLocalMultiSourceAtomicClaimInput,
} from "./localReviewToMultiSourceAtomicClaimBridge";

const REVIEWED_AT = "2026-11-26T21:30:00.000Z";
const SUMMARY =
  "Resumen original sintético para probar la composición editorial entre obras. No contiene texto del EPUB ni afirma hechos narrativos reales.";
const CLAIM: HoidLocalMultiSourceAtomicClaimInput = Object.freeze({
  subjectId: "synthetic-cross-work-subject",
  subjectKind: "character",
  assertionKind: "relationship",
  intent: "context",
  statement:
    "Afirmación sintética de prueba que requiere evidencia independiente de dos obras distintas para poder considerarse completa.",
});

function sourcePacket(workId: string, chapterNumber = 1, overrideDigest?: string): HoidHistoricalEditorialReviewPacket {
  const manifestResult = getHoidReadingManifest(workId);
  if (manifestResult.status !== "ready") throw new Error("Expected a verified test manifest");
  const manifest = manifestResult.manifest;
  const documentSha256 = overrideDigest ??
    getVerifiedChapterDocumentSha256(
      workId,
      manifest.editionId,
      manifest.navigationSha256,
      chapterNumber,
    ) ??
    "b".repeat(64);

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
      receiptFingerprint: sha256Hex("source-receipt-" + workId + "-" + chapterNumber),
      documentSha256,
      navigationSha256: manifest.navigationSha256,
      byteLength: 512,
      inspectedAt: "2026-11-26T20:45:00.000Z",
    }),
  );
  if (result.status !== "ready") throw new Error("Expected a valid source review packet");
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

function validSources() {
  const tfe = sourcePacket("tfe", 1);
  const twok = sourcePacket("twok", 1);
  return Object.freeze([
    Object.freeze({ packet: tfe, receipt: reviewReceipt(tfe) }),
    Object.freeze({ packet: twok, receipt: reviewReceipt(twok) }),
  ]);
}

function progress(positions: Array<{ bookId: string; chapter?: number; completed?: boolean }>) {
  const cursorPositions = positions.map(position => {
    if (position.completed === true) {
      return { bookId: position.bookId, completed: true as const };
    }
    const created = createHoidReadingCursor(position.bookId, position.chapter);
    if (created.status !== "ready") throw new Error("Expected a valid progress cursor");
    return { bookId: position.bookId, cursor: created.cursor };
  });
  return {
    schemaVersion: 2,
    revision: cursorPositions.length === 0 ? 0 : 1,
    positions: cursorPositions,
    updatedAt: cursorPositions.length === 0 ? null : "2026-11-26T21:35:00.000Z",
  };
}

describe("Hoid local review to multi-source atomic claim bridge", () => {
  it("creates one cross-work claim whose every source chapter is a mandatory evidence requirement", () => {
    const result = buildHoidLocalReviewMultiSourceAtomicClaimCandidate(validSources(), CLAIM);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    expect(result.candidate.evidenceSemantics).toBe("all-required-and");
    expect(result.candidate.sourceCount).toBe(2);
    expect(result.candidate.distinctWorkCount).toBe(2);
    expect(result.candidate.claimDraft.evidence).toHaveLength(2);
    expect(result.candidate.claimDraft.evidence.map(item => item.source.bookId).sort()).toEqual(["tfe", "twok"]);
    expect(result.candidate.claimDraft.evidence.every(item =>
      item.unlock.bookId === item.source.bookId &&
      item.unlock.chapter === item.source.chapter,
    )).toBe(true);
    expect(result.candidate.stage).toBe("awaiting-independent-claim-review");
    expect(result.candidate.claimDraft.review.status).toBe("pending-review");
    expect(result.candidate.claimReviewPacket.status).toBe("pending-review");
  });

  it("keeps the cross-work claim withheld until every source book passes its chapter threshold", () => {
    const result = buildHoidLocalReviewMultiSourceAtomicClaimCandidate(validSources(), CLAIM);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    const partial = evaluateHoidEditorialClaimDrafts(
      [result.candidate.claimDraft],
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

    const complete = evaluateHoidEditorialClaimDrafts(
      [result.candidate.claimDraft],
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

  it("does not carry any chapter summary or source passage into the candidate", () => {
    const result = buildHoidLocalReviewMultiSourceAtomicClaimCandidate(validSources(), CLAIM);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.candidate.sourceSummariesIncluded).toBe(false);
    expect(result.candidate.sourceTextIncluded).toBe(false);
    expect(result.candidate.sourceTextPersisted).toBe(false);
    expect("summaryText" in result.candidate).toBe(false);
    expect(result.candidate.claimDraft.statement).toBe(CLAIM.statement);
  });

  it("produces a deterministic candidate regardless of source input order", () => {
    const sources = validSources();
    const forward = buildHoidLocalReviewMultiSourceAtomicClaimCandidate(sources, CLAIM);
    const reverse = buildHoidLocalReviewMultiSourceAtomicClaimCandidate([...sources].reverse(), CLAIM);
    expect(forward.status).toBe("ready");
    expect(reverse.status).toBe("ready");
    if (forward.status !== "ready" || reverse.status !== "ready") return;
    expect(forward.candidate.candidateId).toBe(reverse.candidate.candidateId);
    expect(forward.candidate.claimDraft.integrity.claimSha256).toBe(
      reverse.candidate.claimDraft.integrity.claimSha256,
    );
  });

  it("rejects duplicate source chapters", () => {
    const sources = validSources();
    expect(buildHoidLocalReviewMultiSourceAtomicClaimCandidate(
      [sources[0], sources[0]], CLAIM,
    )).toMatchObject({ status: "invalid", reason: "duplicate-source" });
  });

  it("requires at least two distinct works, not merely two chapters", () => {
    const first = sourcePacket("tfe", 1);
    const second = sourcePacket("tfe", 2);
    expect(buildHoidLocalReviewMultiSourceAtomicClaimCandidate([
      { packet: first, receipt: reviewReceipt(first) },
      { packet: second, receipt: reviewReceipt(second) },
    ], CLAIM)).toMatchObject({ status: "invalid", reason: "cross-work-evidence-required" });
  });

  it("rejects a source review that is not approved", () => {
    const packet = sourcePacket("tfe", 1);
    const other = sourcePacket("twok", 1);
    expect(buildHoidLocalReviewMultiSourceAtomicClaimCandidate([
      { packet, receipt: reviewReceipt(packet, "revision-required") },
      { packet: other, receipt: reviewReceipt(other) },
    ], CLAIM)).toMatchObject({ status: "invalid", reason: "source-review-not-approved" });
  });

  it("rejects a receipt bound to a different source packet", () => {
    const first = sourcePacket("tfe", 1);
    const second = sourcePacket("twok", 1);
    expect(buildHoidLocalReviewMultiSourceAtomicClaimCandidate([
      { packet: first, receipt: reviewReceipt(second) },
      { packet: second, receipt: reviewReceipt(second) },
    ], CLAIM)).toMatchObject({ status: "invalid", reason: "invalid-source-review-receipt" });
  });

  it("rejects a source packet whose summary changed after local review", () => {
    const sources = validSources();
    const tampered = Object.freeze({
      ...sources[0].packet,
      summaryText: "Resumen modificado después de la revisión.",
    });
    expect(buildHoidLocalReviewMultiSourceAtomicClaimCandidate([
      { packet: tampered, receipt: sources[0].receipt },
      sources[1],
    ], CLAIM)).toMatchObject({ status: "invalid", reason: "invalid-source-packet" });
  });

  it("rejects a source document that is not in the sparse verified chapter corpus", () => {
    const manifest = getHoidReadingManifest("tfe");
    if (manifest.status !== "ready") throw new Error("Expected TFE manifest");
    const chapter = manifest.manifest.units.find(unit =>
      getVerifiedChapterDocumentSha256(
        "tfe",
        manifest.manifest.editionId,
        manifest.manifest.navigationSha256,
        unit.chapterNumber,
      ) === null,
    );
    if (!chapter) throw new Error("Expected an unverified chapter fixture");
    const unverified = sourcePacket("tfe", chapter.chapterNumber, "b".repeat(64));
    const verified = sourcePacket("twok", 1);
    expect(buildHoidLocalReviewMultiSourceAtomicClaimCandidate([
      { packet: unverified, receipt: reviewReceipt(unverified) },
      { packet: verified, receipt: reviewReceipt(verified) },
    ], CLAIM)).toMatchObject({ status: "invalid", reason: "source-not-in-verified-claim-corpus" });
  });

  it("rejects fewer than two and more than eight source reviews", () => {
    const sources = validSources();
    expect(buildHoidLocalReviewMultiSourceAtomicClaimCandidate([sources[0]], CLAIM))
      .toMatchObject({ status: "invalid", reason: "invalid-source-list" });
    expect(buildHoidLocalReviewMultiSourceAtomicClaimCandidate(
      Array.from({ length: 9 }, () => sources[0]), CLAIM,
    )).toMatchObject({ status: "invalid", reason: "invalid-source-list" });
  });

  it("rejects accessor-backed source arrays and records", () => {
    const sources = validSources();
    const accessorRecord = Object.defineProperty({}, "packet", {
      enumerable: true,
      get: () => sources[0].packet,
    });
    Object.defineProperty(accessorRecord, "receipt", {
      enumerable: true,
      value: sources[0].receipt,
    });
    expect(buildHoidLocalReviewMultiSourceAtomicClaimCandidate([
      accessorRecord,
      sources[1],
    ], CLAIM)).toMatchObject({ status: "invalid", reason: "invalid-source-list" });

    const sparse = new Array(2);
    sparse[1] = sources[1];
    expect(buildHoidLocalReviewMultiSourceAtomicClaimCandidate(sparse, CLAIM))
      .toMatchObject({ status: "invalid", reason: "invalid-source-list" });
  });

  it("rejects malformed claims and unexpected fields", () => {
    const sources = validSources();
    expect(buildHoidLocalReviewMultiSourceAtomicClaimCandidate(sources, {
      ...CLAIM,
      extra: true,
    })).toMatchObject({ status: "invalid", reason: "invalid-claim-input" });
    expect(buildHoidLocalReviewMultiSourceAtomicClaimCandidate(sources, {
      ...CLAIM,
      statement: "short",
    })).toMatchObject({ status: "invalid", reason: "invalid-claim-input" });
  });
});
