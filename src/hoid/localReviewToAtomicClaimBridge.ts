import type { HoidKnowledgeKind } from "./knowledgeKinds";
import {
  createHoidEditorialClaimDraft,
  type HoidEditorialClaimAssertionKind,
  type HoidEditorialClaimDraft,
} from "./editorialClaimDrafts";
import {
  buildHoidEditorialClaimReviewPackets,
  type HoidEditorialClaimReviewPacket,
} from "./editorialClaimReviewPackets";
import {
  validateHoidHistoricalEditorialReviewPacket,
  validateHoidHistoricalEditorialReviewReceipt,
  type HoidHistoricalEditorialReviewPacket,
  type HoidHistoricalEditorialReviewReceipt,
} from "./historicalEditorialReview";
import { getHoidReadingManifest } from "./readingManifest";
import { sha256Hex } from "./sha256";
import { getVerifiedChapterDocumentSha256 } from "./verifiedChapterDocuments";

export type HoidLocalAtomicClaimInput = Readonly<{
  subjectId: string;
  subjectKind: HoidKnowledgeKind;
  assertionKind: HoidEditorialClaimAssertionKind;
  intent: "explain" | "context" | "recommend";
  statement: string;
}>;

export type HoidLocalReviewAtomicClaimCandidate = Readonly<{
  schemaVersion: 1;
  candidateId: string;
  sourceReviewPacketId: string;
  sourceReviewReceiptSha256: string;
  sourceReviewTrust: "local-unverified";
  claimDraft: HoidEditorialClaimDraft;
  claimReviewPacket: HoidEditorialClaimReviewPacket;
  stage: "awaiting-independent-claim-review";
  sourceSummaryIncluded: false;
  sourceTextIncluded: false;
  sourceTextPersisted: false;
  providerEgress: "none";
  promotionAllowed: false;
  productionWritePerformed: false;
  authorizationEffect: "none";
  spoilerAuthorization: "none";
}>;

export type HoidLocalReviewAtomicClaimBridgeResult =
  | Readonly<{
      status: "ready";
      candidate: HoidLocalReviewAtomicClaimCandidate;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-source-packet"
        | "invalid-source-review-receipt"
        | "source-review-not-approved"
        | "invalid-claim-input"
        | "manifest-unavailable"
        | "source-unit-ambiguous"
        | "source-not-in-verified-claim-corpus"
        | "claim-draft-invalid"
        | "claim-review-packet-invalid";
      promotionAllowed: false;
      productionWritePerformed: false;
    }>;

const CLAIM_INPUT_KEYS = new Set([
  "subjectId",
  "subjectKind",
  "assertionKind",
  "intent",
  "statement",
]);

const ASSERTION_KINDS = new Set<HoidEditorialClaimAssertionKind>([
  "identity",
  "appearance",
  "ability",
  "limitation",
  "relationship",
  "event",
  "location",
  "interpretation",
]);

const INTENTS = new Set(["explain", "context", "recommend"]);

function exactRecord(
  value: unknown,
  allowedKeys: ReadonlySet<string>,
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== allowedKeys.size) return null;

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !allowedKeys.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor ||
          !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          descriptor.enumerable !== true) return null;
      result[key] = descriptor.value;
    }
    for (const key of allowedKeys) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    }
    return result;
  } catch {
    return null;
  }
}

function canonicalClaimInput(value: unknown): HoidLocalAtomicClaimInput | null {
  const raw = exactRecord(value, CLAIM_INPUT_KEYS);
  if (!raw) return null;

  const subjectId = typeof raw.subjectId === "string" ? raw.subjectId : "";
  const statement = typeof raw.statement === "string" ? raw.statement : "";
  if (
    !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(subjectId) ||
    subjectId.length > 128 ||
    typeof raw.subjectKind !== "string" ||
    typeof raw.assertionKind !== "string" ||
    !ASSERTION_KINDS.has(raw.assertionKind as HoidEditorialClaimAssertionKind) ||
    typeof raw.intent !== "string" ||
    !INTENTS.has(raw.intent) ||
    statement !== statement.trim() ||
    statement.length < 20 ||
    statement.length > 1_200 ||
    /[\u0000-\u001F\u007F]/u.test(statement)
  ) return null;

  const allowedKinds = new Set([
    "character", "place", "event", "phenomenon",
    "concept", "magic", "organization", "object",
  ]);
  if (!allowedKinds.has(raw.subjectKind)) return null;

  return Object.freeze({
    subjectId,
    subjectKind: raw.subjectKind as HoidKnowledgeKind,
    assertionKind: raw.assertionKind as HoidEditorialClaimAssertionKind,
    intent: raw.intent as HoidLocalAtomicClaimInput["intent"],
    statement,
  });
}

function localReviewReceiptDigest(receipt: HoidHistoricalEditorialReviewReceipt): string {
  return sha256Hex(JSON.stringify([
    "hoid-local-historical-review-receipt-v1",
    receipt.packetId,
    receipt.draftId,
    receipt.summarySha256,
    receipt.sourceReceiptFingerprint,
    receipt.decision,
    receipt.reviewerLabel,
    receipt.reviewedAt,
    receipt.checklist.factualAccuracy,
    receipt.checklist.completeness,
    receipt.checklist.originality,
    receipt.checklist.spoilerCeiling,
    receipt.checklist.provenance,
    [...receipt.noteCodes],
  ]));
}

function invalid(
  reason: Extract<HoidLocalReviewAtomicClaimBridgeResult, { status: "invalid" }>["reason"],
): HoidLocalReviewAtomicClaimBridgeResult {
  return Object.freeze({
    status: "invalid",
    reason,
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

/**
 * Bridges one locally approved chapter summary into one pending atomic-claim
 * review packet. The local reviewer label remains unauthenticated. The exact
 * chapter must also exist in the repository's individually verified claim
 * corpus before the existing atomic-claim validator will accept it.
 *
 * This operation is staging-only: it performs no persistence, provider call,
 * production write, progress mutation or spoiler authorization.
 */
export function buildHoidLocalReviewAtomicClaimCandidate(
  sourcePacketInput: unknown,
  sourceReceiptInput: unknown,
  claimInput: unknown,
): HoidLocalReviewAtomicClaimBridgeResult {
  const sourcePacketResult = validateHoidHistoricalEditorialReviewPacket(sourcePacketInput);
  if (sourcePacketResult.status !== "valid") return invalid("invalid-source-packet");

  const sourcePacket = sourcePacketResult.packet;
  const sourceReceiptResult = validateHoidHistoricalEditorialReviewReceipt(
    sourcePacket,
    sourceReceiptInput,
  );
  if (sourceReceiptResult.status !== "valid") {
    return invalid("invalid-source-review-receipt");
  }
  if (sourceReceiptResult.outcome !== "approved-awaiting-trusted-promotion") {
    return invalid("source-review-not-approved");
  }

  const claim = canonicalClaimInput(claimInput);
  if (!claim) return invalid("invalid-claim-input");

  const manifestResult = getHoidReadingManifest(sourcePacket.workId);
  if (
    manifestResult.status !== "ready" ||
    manifestResult.manifest.editionId !== sourcePacket.editionId ||
    manifestResult.manifest.navigationSha256 !== sourcePacket.sourceEvidence.navigationSha256
  ) return invalid("manifest-unavailable");

  const matchingUnits = manifestResult.manifest.units.filter(unit =>
    unit.chapterNumber === sourcePacket.chapterNumber &&
    typeof unit.locatorId === "string",
  );
  if (matchingUnits.length !== 1) return invalid("source-unit-ambiguous");

  const verifiedDocumentSha256 = getVerifiedChapterDocumentSha256(
    sourcePacket.workId,
    sourcePacket.editionId,
    sourcePacket.sourceEvidence.navigationSha256,
    sourcePacket.chapterNumber,
  );
  if (
    verifiedDocumentSha256 === null ||
    verifiedDocumentSha256 !== sourcePacket.sourceEvidence.documentSha256
  ) return invalid("source-not-in-verified-claim-corpus");

  const sourceReceipt = sourceReceiptResult.receipt;
  const sourceReviewReceiptSha256 = localReviewReceiptDigest(sourceReceipt);
  const claimId = "local-" + sha256Hex(JSON.stringify([
    "hoid-local-atomic-claim-v1",
    sourcePacket.packetId,
    sourceReviewReceiptSha256,
    claim.subjectId,
    claim.subjectKind,
    claim.assertionKind,
    claim.intent,
    sha256Hex(claim.statement),
  ]));

  const draftResult = createHoidEditorialClaimDraft({
    id: claimId,
    subjectId: claim.subjectId,
    subjectKind: claim.subjectKind,
    assertionKind: claim.assertionKind,
    intent: claim.intent,
    statement: claim.statement,
    evidence: Object.freeze([Object.freeze({
      source: Object.freeze({
        bookId: sourcePacket.workId,
        chapter: sourcePacket.chapterNumber,
        locatorId: matchingUnits[0].locatorId,
      }),
      unlock: Object.freeze({
        bookId: sourcePacket.workId,
        chapter: sourcePacket.chapterNumber,
      }),
      sourceIntegrity: Object.freeze({
        editionId: sourcePacket.editionId,
        navigationSha256: sourcePacket.sourceEvidence.navigationSha256,
        documentSha256: sourcePacket.sourceEvidence.documentSha256,
      }),
    })]),
  });
  if (draftResult.status !== "valid") return invalid("claim-draft-invalid");

  const reviewPacketResult = buildHoidEditorialClaimReviewPackets([draftResult.draft]);
  if (reviewPacketResult.status !== "ready" || reviewPacketResult.packets.length !== 1) {
    return invalid("claim-review-packet-invalid");
  }
  const claimReviewPacket = reviewPacketResult.packets[0];
  const candidateId = sha256Hex(JSON.stringify([
    "hoid-local-review-atomic-claim-candidate-v1",
    sourcePacket.packetId,
    sourceReviewReceiptSha256,
    draftResult.draft.integrity.claimSha256,
    claimReviewPacket.packetId,
  ]));

  const candidate: HoidLocalReviewAtomicClaimCandidate = Object.freeze({
    schemaVersion: 1,
    candidateId,
    sourceReviewPacketId: sourcePacket.packetId,
    sourceReviewReceiptSha256,
    sourceReviewTrust: "local-unverified",
    claimDraft: draftResult.draft,
    claimReviewPacket,
    stage: "awaiting-independent-claim-review",
    sourceSummaryIncluded: false,
    sourceTextIncluded: false,
    sourceTextPersisted: false,
    providerEgress: "none",
    promotionAllowed: false,
    productionWritePerformed: false,
    authorizationEffect: "none",
    spoilerAuthorization: "none",
  });

  return Object.freeze({
    status: "ready",
    candidate,
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}
