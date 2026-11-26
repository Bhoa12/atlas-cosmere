import { isHoidKnowledgeKind, type HoidKnowledgeKind } from "./knowledgeKinds";
import {
  createHoidEditorialClaimDraft,
  type HoidEditorialClaimAssertionKind,
  type HoidEditorialClaimEvidence,
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

export type HoidLocalMultiSourceReviewInput = Readonly<{
  packet: unknown;
  receipt: unknown;
}>;

export type HoidLocalMultiSourceAtomicClaimInput = Readonly<{
  subjectId: string;
  subjectKind: HoidKnowledgeKind;
  assertionKind: HoidEditorialClaimAssertionKind;
  intent: "explain" | "context" | "recommend";
  statement: string;
}>;

export type HoidLocalMultiSourceAtomicClaimCandidate = Readonly<{
  schemaVersion: 1;
  candidateId: string;
  sourceReviews: readonly Readonly<{
    packetId: string;
    receiptSha256: string;
    workId: string;
    editionId: string;
    chapterNumber: number;
  }>[];
  sourceReviewTrust: "local-unverified";
  evidenceSemantics: "all-required-and";
  sourceCount: number;
  distinctWorkCount: number;
  claimDraft: HoidEditorialClaimDraft;
  claimReviewPacket: HoidEditorialClaimReviewPacket;
  stage: "awaiting-independent-claim-review";
  sourceSummariesIncluded: false;
  sourceTextIncluded: false;
  sourceTextPersisted: false;
  providerEgress: "none";
  promotionAllowed: false;
  productionWritePerformed: false;
  authorizationEffect: "none";
  spoilerAuthorization: "none";
}>;

export type HoidLocalMultiSourceAtomicClaimResult =
  | Readonly<{
      status: "ready";
      candidate: HoidLocalMultiSourceAtomicClaimCandidate;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-source-list"
        | "invalid-source-packet"
        | "invalid-source-review-receipt"
        | "source-review-not-approved"
        | "invalid-claim-input"
        | "manifest-unavailable"
        | "source-unit-ambiguous"
        | "source-not-in-verified-claim-corpus"
        | "duplicate-source"
        | "cross-work-evidence-required"
        | "claim-draft-invalid"
        | "claim-review-packet-invalid";
      promotionAllowed: false;
      productionWritePerformed: false;
    }>;

const SOURCE_KEYS = new Set(["packet", "receipt"]);
const CLAIM_KEYS = new Set(["subjectId", "subjectKind", "assertionKind", "intent", "statement"]);
const ASSERTION_KINDS = new Set<HoidEditorialClaimAssertionKind>([
  "identity", "appearance", "ability", "limitation",
  "relationship", "event", "location", "interpretation",
]);
const INTENTS = new Set(["explain", "context", "recommend"]);
const MIN_SOURCES = 2;
const MAX_SOURCES = 8;

function exactRecord(value: unknown, allowedKeys: ReadonlySet<string>): Record<string, unknown> | null {
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

function denseArray(value: unknown, minimum: number, maximum: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || value.length < minimum || value.length > maximum) return null;
    if (Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor ||
          !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          descriptor.enumerable !== true) return null;
      result.push(descriptor.value);
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function canonicalClaim(value: unknown): HoidLocalMultiSourceAtomicClaimInput | null {
  const raw = exactRecord(value, CLAIM_KEYS);
  if (!raw) return null;
  const subjectId = typeof raw.subjectId === "string" ? raw.subjectId : "";
  const statement = typeof raw.statement === "string" ? raw.statement : "";
  if (
    !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(subjectId) ||
    subjectId.length > 128 ||
    !isHoidKnowledgeKind(raw.subjectKind) ||
    typeof raw.assertionKind !== "string" ||
    !ASSERTION_KINDS.has(raw.assertionKind as HoidEditorialClaimAssertionKind) ||
    typeof raw.intent !== "string" ||
    !INTENTS.has(raw.intent) ||
    statement !== statement.trim() ||
    statement.length < 20 ||
    statement.length > 1_200 ||
    /[\u0000-\u001F\u007F]/u.test(statement)
  ) return null;

  return Object.freeze({
    subjectId,
    subjectKind: raw.subjectKind,
    assertionKind: raw.assertionKind as HoidEditorialClaimAssertionKind,
    intent: raw.intent as HoidLocalMultiSourceAtomicClaimInput["intent"],
    statement,
  });
}

function reviewReceiptDigest(receipt: HoidHistoricalEditorialReviewReceipt): string {
  return sha256Hex(JSON.stringify([
    "hoid-local-multi-source-review-receipt-v1",
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

type InvalidMultiSourceResult = Extract<HoidLocalMultiSourceAtomicClaimResult, { status: "invalid" }>;

function invalid(
  reason: InvalidMultiSourceResult["reason"],
): InvalidMultiSourceResult {
  return Object.freeze({
    status: "invalid",
    reason,
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

type VerifiedLocalSource = Readonly<{
  packet: HoidHistoricalEditorialReviewPacket;
  receipt: HoidHistoricalEditorialReviewReceipt;
  evidence: HoidEditorialClaimEvidence;
  receiptSha256: string;
}>;

function verifyLocalSource(input: unknown): VerifiedLocalSource | InvalidMultiSourceResult {
  const raw = exactRecord(input, SOURCE_KEYS);
  if (!raw) return invalid("invalid-source-list");

  const packetResult = validateHoidHistoricalEditorialReviewPacket(raw.packet);
  if (packetResult.status !== "valid") return invalid("invalid-source-packet");
  const packet = packetResult.packet;

  const receiptResult = validateHoidHistoricalEditorialReviewReceipt(packet, raw.receipt);
  if (receiptResult.status !== "valid") return invalid("invalid-source-review-receipt");
  if (receiptResult.outcome !== "approved-awaiting-trusted-promotion") {
    return invalid("source-review-not-approved");
  }

  const manifestResult = getHoidReadingManifest(packet.workId);
  if (
    manifestResult.status !== "ready" ||
    manifestResult.manifest.editionId !== packet.editionId ||
    manifestResult.manifest.navigationSha256 !== packet.sourceEvidence.navigationSha256
  ) return invalid("manifest-unavailable");

  const units = manifestResult.manifest.units.filter(unit =>
    unit.chapterNumber === packet.chapterNumber && typeof unit.locatorId === "string",
  );
  if (units.length !== 1) return invalid("source-unit-ambiguous");

  const documentSha256 = getVerifiedChapterDocumentSha256(
    packet.workId,
    packet.editionId,
    packet.sourceEvidence.navigationSha256,
    packet.chapterNumber,
  );
  if (documentSha256 === null || documentSha256 !== packet.sourceEvidence.documentSha256) {
    return invalid("source-not-in-verified-claim-corpus");
  }

  const locatorId = units[0].locatorId;
  if (typeof locatorId !== "string") return invalid("source-unit-ambiguous");

  const evidence: HoidEditorialClaimEvidence = Object.freeze({
    source: Object.freeze({
      bookId: packet.workId,
      chapter: packet.chapterNumber,
      locatorId,
    }),
    unlock: Object.freeze({
      bookId: packet.workId,
      chapter: packet.chapterNumber,
    }),
    sourceIntegrity: Object.freeze({
      editionId: packet.editionId,
      navigationSha256: packet.sourceEvidence.navigationSha256,
      documentSha256,
    }),
  });

  return Object.freeze({
    packet,
    receipt: receiptResult.receipt,
    evidence,
    receiptSha256: reviewReceiptDigest(receiptResult.receipt),
  });
}

/**
 * Builds one cross-work atomic claim from two to eight independently
 * source-bound local chapter reviews. Every evidence item is mandatory:
 * downstream cursor evaluation therefore applies logical AND across all
 * books and chapter thresholds. Local labels remain unauthenticated and the
 * result is staging-only; no provider, persistence, promotion or spoiler
 * authorization is performed.
 */
export function buildHoidLocalReviewMultiSourceAtomicClaimCandidate(
  sourcesInput: unknown,
  claimInput: unknown,
): HoidLocalMultiSourceAtomicClaimResult {
  const rawSources = denseArray(sourcesInput, MIN_SOURCES, MAX_SOURCES);
  if (!rawSources) return invalid("invalid-source-list");

  const claim = canonicalClaim(claimInput);
  if (!claim) return invalid("invalid-claim-input");

  const verified: VerifiedLocalSource[] = [];
  const sourceKeys = new Set<string>();
  const workIds = new Set<string>();

  for (const rawSource of rawSources) {
    const result = verifyLocalSource(rawSource);
    if ("status" in result) return result;

    const source = result;
    const key = [
      source.packet.workId,
      String(source.packet.chapterNumber),
      source.packet.sourceEvidence.documentSha256,
    ].join(":");
    if (sourceKeys.has(key)) return invalid("duplicate-source");
    sourceKeys.add(key);
    workIds.add(source.packet.workId);
    verified.push(source);
  }

  if (workIds.size < 2) return invalid("cross-work-evidence-required");

  const canonicalSources = [...verified].sort((left, right) => {
    const a = left.packet.workId + "\n" +
      String(left.packet.chapterNumber).padStart(10, "0") + "\n" +
      left.packet.sourceEvidence.documentSha256;
    const b = right.packet.workId + "\n" +
      String(right.packet.chapterNumber).padStart(10, "0") + "\n" +
      right.packet.sourceEvidence.documentSha256;
    return a < b ? -1 : a > b ? 1 : 0;
  });

  const evidence = Object.freeze(canonicalSources.map(source => source.evidence));
  const claimId = "local-" + sha256Hex(JSON.stringify([
    "hoid-local-multi-source-atomic-claim-v1",
    canonicalSources.map(source => [
      source.packet.packetId,
      source.receiptSha256,
      source.packet.workId,
      source.packet.editionId,
      source.packet.chapterNumber,
    ]),
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
    evidence,
  });
  if (draftResult.status !== "valid") return invalid("claim-draft-invalid");

  const reviewResult = buildHoidEditorialClaimReviewPackets([draftResult.draft]);
  if (reviewResult.status !== "ready" || reviewResult.packets.length !== 1) {
    return invalid("claim-review-packet-invalid");
  }

  const sourceReviews = Object.freeze(canonicalSources.map(source => Object.freeze({
    packetId: source.packet.packetId,
    receiptSha256: source.receiptSha256,
    workId: source.packet.workId,
    editionId: source.packet.editionId,
    chapterNumber: source.packet.chapterNumber,
  })));
  const candidateId = sha256Hex(JSON.stringify([
    "hoid-local-multi-source-atomic-candidate-v1",
    sourceReviews.map(source => [
      source.packetId,
      source.receiptSha256,
      source.workId,
      source.editionId,
      source.chapterNumber,
    ]),
    draftResult.draft.integrity.claimSha256,
    reviewResult.packets[0].packetId,
  ]));

  const candidate: HoidLocalMultiSourceAtomicClaimCandidate = Object.freeze({
    schemaVersion: 1,
    candidateId,
    sourceReviews,
    sourceReviewTrust: "local-unverified",
    evidenceSemantics: "all-required-and",
    sourceCount: sourceReviews.length,
    distinctWorkCount: workIds.size,
    claimDraft: draftResult.draft,
    claimReviewPacket: reviewResult.packets[0],
    stage: "awaiting-independent-claim-review",
    sourceSummariesIncluded: false,
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
