import { describe, expect, it } from "vitest";
import {
  buildHoidHistoricalEditorialReviewPacket,
  validateHoidHistoricalEditorialReviewDecision,
  type HoidHistoricalEditorialReviewPacket,
} from "./historicalEditorialReview";
import { getHoidReadingManifest } from "./readingManifest";
import { sha256Hex } from "./sha256";
import {
  getVerifiedChapterDocumentNumbers,
  getVerifiedChapterDocumentSha256,
} from "./verifiedChapterDocuments";
import {
  buildHoidLocalReviewAtomicClaimCandidate,
  type HoidLocalAtomicClaimInput,
} from "./localReviewToAtomicClaimBridge";

const WORK_ID = "twok";
const manifestResult = getHoidReadingManifest(WORK_ID);
if (manifestResult.status !== "ready") throw new Error("Expected a verified test manifest");
const manifest = manifestResult.manifest;
const REVIEWED_AT = "2026-11-26T20:30:00.000Z";
const SUMMARY =
  "Resumen original sintético para probar la frontera editorial local. No contiene texto del EPUB ni afirma hechos narrativos reales.";
const CLAIM: HoidLocalAtomicClaimInput = Object.freeze({
  subjectId: "synthetic-test-subject",
  subjectKind: "character",
  assertionKind: "interpretation",
  intent: "explain",
  statement: "Afirmación sintética de prueba para validar la conversión de un resumen local en una unidad atómica revisable.",
});

function sourcePacket(
  chapterNumber = 1,
  documentSha256?: string,
): HoidHistoricalEditorialReviewPacket {
  const documentDigest = documentSha256 ??
    getVerifiedChapterDocumentSha256(
      WORK_ID,
      manifest.editionId,
      manifest.navigationSha256,
      chapterNumber,
    ) ??
    "b".repeat(64);
  const result = buildHoidHistoricalEditorialReviewPacket(
    Object.freeze({
      schemaVersion: 1,
      scope: "ephemeral-local-editorial-draft",
      workId: WORK_ID,
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
      receiptFingerprint: sha256Hex("source-receipt-" + chapterNumber),
      documentSha256: documentDigest,
      navigationSha256: manifest.navigationSha256,
      byteLength: 512,
      inspectedAt: "2026-11-26T19:45:00.000Z",
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

describe("Hoid local review to atomic claim bridge", () => {
  it("creates one pending atomic claim from a locally approved, exactly verified chapter", () => {
    const packet = sourcePacket();
    const receipt = reviewReceipt(packet);
    const result = buildHoidLocalReviewAtomicClaimCandidate(packet, receipt, CLAIM);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    expect(result.candidate.stage).toBe("awaiting-independent-claim-review");
    expect(result.candidate.sourceReviewTrust).toBe("local-unverified");
    expect(result.candidate.claimDraft.review.status).toBe("pending-review");
    expect(result.candidate.claimReviewPacket.status).toBe("pending-review");
    expect(result.candidate.claimDraft.evidence).toHaveLength(1);
    expect(result.candidate.claimDraft.evidence[0].source).toEqual({
      bookId: WORK_ID,
      chapter: 1,
      locatorId: manifest.units.find(unit => unit.chapterNumber === 1)?.locatorId,
    });
    expect(result.candidate.claimDraft.evidence[0].unlock).toEqual({
      bookId: WORK_ID,
      chapter: 1,
    });
    expect(result.candidate.promotionAllowed).toBe(false);
    expect(result.candidate.productionWritePerformed).toBe(false);
    expect(result.candidate.providerEgress).toBe("none");
    expect(result.candidate.spoilerAuthorization).toBe("none");
  });

  it("does not carry the chapter summary or any source passage into the claim candidate", () => {
    const packet = sourcePacket();
    const result = buildHoidLocalReviewAtomicClaimCandidate(packet, reviewReceipt(packet), CLAIM);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.candidate.sourceSummaryIncluded).toBe(false);
    expect(result.candidate.sourceTextIncluded).toBe(false);
    expect(result.candidate.sourceTextPersisted).toBe(false);
    expect("summaryText" in result.candidate).toBe(false);
    expect(result.candidate.claimDraft.statement).toBe(CLAIM.statement);
  });

  it("binds the candidate identity to the source review receipt and atomic claim", () => {
    const packet = sourcePacket();
    const receipt = reviewReceipt(packet);
    const first = buildHoidLocalReviewAtomicClaimCandidate(packet, receipt, CLAIM);
    const second = buildHoidLocalReviewAtomicClaimCandidate(packet, receipt, CLAIM);

    expect(first.status).toBe("ready");
    expect(second.status).toBe("ready");
    if (first.status !== "ready" || second.status !== "ready") return;
    expect(first.candidate.candidateId).toBe(second.candidate.candidateId);

    const changedClaim = Object.freeze({ ...CLAIM, statement: CLAIM.statement + " Otra proposición." });
    const changed = buildHoidLocalReviewAtomicClaimCandidate(packet, receipt, changedClaim);
    expect(changed.status).toBe("ready");
    if (changed.status === "ready") {
      expect(changed.candidate.candidateId).not.toBe(first.candidate.candidateId);
    }
  });

  it("rejects a source packet whose summary digest has been changed", () => {
    const packet = sourcePacket();
    const receipt = reviewReceipt(packet);
    const tampered = Object.freeze({ ...packet, summaryText: "Resumen alterado después de la revisión." });

    expect(buildHoidLocalReviewAtomicClaimCandidate(tampered, receipt, CLAIM)).toMatchObject({
      status: "invalid",
      reason: "invalid-source-packet",
    });
  });

  it("rejects a receipt bound to another source packet", () => {
    const packet = sourcePacket();
    const otherPacket = sourcePacket(2);
    const receipt = reviewReceipt(otherPacket);

    expect(buildHoidLocalReviewAtomicClaimCandidate(packet, receipt, CLAIM)).toMatchObject({
      status: "invalid",
      reason: "invalid-source-review-receipt",
    });
  });

  it("does not promote revision-required or rejected local source reviews", () => {
    const packet = sourcePacket();
    const receipt = reviewReceipt(packet, "revision-required");

    expect(buildHoidLocalReviewAtomicClaimCandidate(packet, receipt, CLAIM)).toMatchObject({
      status: "invalid",
      reason: "source-review-not-approved",
    });
  });

  it("requires the exact source document to exist in the verified atomic-claim corpus", () => {
    const verified = new Set(getVerifiedChapterDocumentNumbers(WORK_ID));
    const unregistered = manifest.units.find(unit =>
      !verified.has(unit.chapterNumber) && typeof unit.locatorId === "string",
    );
    if (!unregistered) throw new Error("Expected an unregistered chapter fixture");
    const packet = sourcePacket(unregistered.chapterNumber, "b".repeat(64));

    expect(buildHoidLocalReviewAtomicClaimCandidate(packet, reviewReceipt(packet), CLAIM)).toMatchObject({
      status: "invalid",
      reason: "source-not-in-verified-claim-corpus",
    });
  });

  it("rejects malformed claim inputs and non-canonical entity kinds", () => {
    const packet = sourcePacket();
    const receipt = reviewReceipt(packet);

    expect(buildHoidLocalReviewAtomicClaimCandidate(packet, receipt, {
      ...CLAIM,
      extra: "not-allowed",
    })).toMatchObject({ status: "invalid", reason: "invalid-claim-input" });

    expect(buildHoidLocalReviewAtomicClaimCandidate(packet, receipt, {
      ...CLAIM,
      subjectKind: "planet",
    })).toMatchObject({ status: "invalid", reason: "invalid-claim-input" });
  });

  it("rejects empty, short and control-character claim statements", () => {
    const packet = sourcePacket();
    const receipt = reviewReceipt(packet);

    for (const statement of ["", "demasiado corto", "Afirmación\u0000invalida para la revisión"]) {
      expect(buildHoidLocalReviewAtomicClaimCandidate(packet, receipt, {
        ...CLAIM,
        statement,
      })).toMatchObject({ status: "invalid", reason: "invalid-claim-input" });
    }
  });

  it("requires a unique exact chapter locator before constructing evidence", () => {
    const packet = sourcePacket();
    const ambiguous = Object.freeze({
      ...packet,
      chapterNumber: 0,
      declaredSpoilerCeilingChapter: 0,
    });
    expect(buildHoidLocalReviewAtomicClaimCandidate(ambiguous, reviewReceipt(packet), CLAIM)).toMatchObject({
      status: "invalid",
      reason: "invalid-source-packet",
    });
  });
});
