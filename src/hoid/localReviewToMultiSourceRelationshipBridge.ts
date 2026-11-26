import type { HoidKnowledgeGraphPredicate } from "./knowledgeGraph";
import {
  validateHoidEditorialEntityDraft,
  type HoidEditorialEntityDraft,
} from "./editorialEntityDrafts";
import {
  buildHoidEditorialRelationshipReviewPackets,
  createHoidEditorialRelationshipDraft,
  type HoidEditorialRelationshipDraft,
  type HoidEditorialRelationshipReviewPacket,
} from "./editorialRelationshipDrafts";
import {
  buildHoidLocalReviewMultiSourceAtomicClaimCandidate,
  type HoidLocalMultiSourceAtomicClaimInput,
} from "./localReviewToMultiSourceAtomicClaimBridge";
import type { HoidEditorialClaimEvidence } from "./editorialClaimDrafts";
import { sha256Hex } from "./sha256";

export type HoidLocalMultiSourceRelationshipInput = Readonly<{
  predicate: HoidKnowledgeGraphPredicate;
  subjectDraft: unknown;
  objectDraft: unknown;
  intent: "explain" | "context";
  statement: string;
}>;

export type HoidLocalMultiSourceRelationshipCandidate = Readonly<{
  schemaVersion: 1;
  candidateId: string;
  atomicClaimCandidateId: string;
  sourceReviews: readonly Readonly<{
    packetId: string;
    receiptSha256: string;
    workId: string;
    editionId: string;
    chapterNumber: number;
  }>[];
  sourceCount: number;
  distinctWorkCount: number;
  sourceReviewTrust: "local-unverified";
  relationshipDraft: HoidEditorialRelationshipDraft;
  relationshipReviewPacket: HoidEditorialRelationshipReviewPacket;
  stage: "awaiting-independent-relationship-review";
  sourceSummariesIncluded: false;
  sourceTextIncluded: false;
  sourceTextPersisted: false;
  providerEgress: "none";
  promotionAllowed: false;
  productionWritePerformed: false;
  authorizationEffect: "none";
  spoilerAuthorization: "none";
}>;

export type HoidLocalMultiSourceRelationshipResult =
  | Readonly<{
      status: "ready";
      candidate: HoidLocalMultiSourceRelationshipCandidate;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-relationship-input"
        | "unresolved-participant"
        | "participant-evidence-not-in-source-set"
        | "multi-source-claim-invalid"
        | "relationship-draft-invalid"
        | "relationship-review-packet-invalid";
      promotionAllowed: false;
      productionWritePerformed: false;
    }>;

const RELATIONSHIP_KEYS = new Set([
  "predicate",
  "subjectDraft",
  "objectDraft",
  "intent",
  "statement",
]);
const PREDICATES = new Set<HoidKnowledgeGraphPredicate>([
  "related-to",
  "appears-in",
  "located-in",
  "member-of",
  "uses",
  "participates-in",
  "created-by",
  "part-of",
  "causes",
  "opposes",
  "allied-with",
]);
const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const MAX_STATEMENT_LENGTH = 1_200;

type CanonicalRelationshipInput = Readonly<{
  predicate: HoidKnowledgeGraphPredicate;
  subjectDraft: HoidEditorialEntityDraft;
  objectDraft: HoidEditorialEntityDraft;
  intent: "explain" | "context";
  statement: string;
}>;

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
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
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

function canonicalRelationshipInput(value: unknown):
  | Readonly<{ status: "valid"; input: CanonicalRelationshipInput }>
  | Readonly<{ status: "invalid" }> {
  const raw = exactRecord(value, RELATIONSHIP_KEYS);
  if (
    !raw ||
    typeof raw.predicate !== "string" ||
    !PREDICATES.has(raw.predicate as HoidKnowledgeGraphPredicate) ||
    (raw.intent !== "explain" && raw.intent !== "context") ||
    typeof raw.statement !== "string" ||
    raw.statement !== raw.statement.trim() ||
    raw.statement.length < 20 ||
    raw.statement.length > MAX_STATEMENT_LENGTH ||
    /[\u0000-\u001F\u007F]/u.test(raw.statement)
  ) return Object.freeze({ status: "invalid" });

  const subject = validateHoidEditorialEntityDraft(raw.subjectDraft);
  if (subject.status !== "valid") return Object.freeze({ status: "invalid" });
  const object = validateHoidEditorialEntityDraft(raw.objectDraft);
  if (object.status !== "valid") return Object.freeze({ status: "invalid" });

  return Object.freeze({
    status: "valid",
    input: Object.freeze({
      predicate: raw.predicate as HoidKnowledgeGraphPredicate,
      subjectDraft: subject.draft,
      objectDraft: object.draft,
      intent: raw.intent,
      statement: raw.statement,
    }),
  });
}

function evidenceKey(value: HoidEditorialClaimEvidence): string {
  return JSON.stringify([
    value.source.bookId,
    value.source.chapter,
    value.source.locatorId,
    value.unlock.bookId,
    value.unlock.chapter,
    value.sourceIntegrity.editionId,
    value.sourceIntegrity.navigationSha256,
    value.sourceIntegrity.documentSha256,
  ]);
}

function participantEvidenceIndices(
  entity: HoidEditorialEntityDraft,
  relationshipEvidence: readonly HoidEditorialClaimEvidence[],
): readonly number[] | null {
  const available = new Map(relationshipEvidence.map((item, index) => [evidenceKey(item), index]));
  const indices: number[] = [];
  const seen = new Set<number>();

  for (const evidence of entity.evidence) {
    const index = available.get(evidenceKey(evidence));
    if (index === undefined || seen.has(index)) return null;
    seen.add(index);
    indices.push(index);
  }
  if (indices.length === 0) return null;
  indices.sort((left, right) => left - right);
  return Object.freeze(indices);
}

function invalid(
  reason: Extract<HoidLocalMultiSourceRelationshipResult, { status: "invalid" }>["reason"],
): Extract<HoidLocalMultiSourceRelationshipResult, { status: "invalid" }> {
  return Object.freeze({
    status: "invalid",
    reason,
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

/**
 * Convert independently approved local chapter reviews into one cross-work
 * relationship draft. Both endpoint identity dossiers must be verified and
 * every dossier evidence item must be present in the exact source set used by
 * the relationship. All source reviews remain mandatory AND evidence.
 *
 * The output is review staging only. Local labels are unauthenticated, no
 * source summary or passage is copied, no provider is called, and no graph,
 * production registry, progress state or spoiler authorization is changed.
 */
export function buildHoidLocalReviewMultiSourceRelationshipCandidate(
  sourcesInput: unknown,
  relationshipInput: unknown,
): HoidLocalMultiSourceRelationshipResult {
  const canonical = canonicalRelationshipInput(relationshipInput);
  if (canonical.status !== "valid") return invalid("invalid-relationship-input");
  const relationship = canonical.input;

  if (
    relationship.subjectDraft.identity.status !== "resolved" ||
    relationship.objectDraft.identity.status !== "resolved"
  ) return invalid("unresolved-participant");

  const claimInput: HoidLocalMultiSourceAtomicClaimInput = Object.freeze({
    subjectId: relationship.subjectDraft.id,
    subjectKind: relationship.subjectDraft.kind,
    assertionKind: "relationship",
    intent: relationship.intent,
    statement: relationship.statement,
  });
  const atomicResult = buildHoidLocalReviewMultiSourceAtomicClaimCandidate(
    sourcesInput,
    claimInput,
  );
  if (atomicResult.status !== "ready") return invalid("multi-source-claim-invalid");

  const evidence = atomicResult.candidate.claimDraft.evidence;
  const subjectEvidenceIndices = participantEvidenceIndices(
    relationship.subjectDraft,
    evidence,
  );
  if (!subjectEvidenceIndices) return invalid("participant-evidence-not-in-source-set");
  const objectEvidenceIndices = participantEvidenceIndices(
    relationship.objectDraft,
    evidence,
  );
  if (!objectEvidenceIndices) return invalid("participant-evidence-not-in-source-set");

  const relationEvidenceIndices = Object.freeze(
    evidence.map((_item, index) => index),
  );
  const relationshipId = atomicResult.candidate.claimDraft.id + ".relationship";
  if (!ID_PATTERN.test(relationshipId) || relationshipId.length > 128) {
    return invalid("relationship-draft-invalid");
  }

  const relationshipResult = createHoidEditorialRelationshipDraft({
    id: relationshipId,
    predicate: relationship.predicate,
    subject: Object.freeze({
      id: relationship.subjectDraft.id,
      kind: relationship.subjectDraft.kind,
      evidenceIndices: subjectEvidenceIndices,
    }),
    object: Object.freeze({
      id: relationship.objectDraft.id,
      kind: relationship.objectDraft.kind,
      evidenceIndices: objectEvidenceIndices,
    }),
    intent: relationship.intent,
    statement: relationship.statement,
    evidence,
    relationEvidenceIndices,
  });
  if (relationshipResult.status !== "valid") {
    return invalid("relationship-draft-invalid");
  }

  const packetResult = buildHoidEditorialRelationshipReviewPackets([
    relationshipResult.draft,
  ]);
  if (packetResult.status !== "ready" || packetResult.packets.length !== 1) {
    return invalid("relationship-review-packet-invalid");
  }
  const packet = packetResult.packets[0];

  const candidateId = sha256Hex(JSON.stringify([
    "hoid-local-multi-source-relationship-candidate-v1",
    atomicResult.candidate.candidateId,
    relationship.subjectDraft.id,
    relationship.subjectDraft.integrity.draftSha256,
    relationship.objectDraft.id,
    relationship.objectDraft.integrity.draftSha256,
    relationshipResult.draft.integrity.claimSha256,
    packet.packetId,
  ]));

  const candidate: HoidLocalMultiSourceRelationshipCandidate = Object.freeze({
    schemaVersion: 1,
    candidateId,
    atomicClaimCandidateId: atomicResult.candidate.candidateId,
    sourceReviews: atomicResult.candidate.sourceReviews,
    sourceCount: atomicResult.candidate.sourceCount,
    distinctWorkCount: atomicResult.candidate.distinctWorkCount,
    sourceReviewTrust: "local-unverified",
    relationshipDraft: relationshipResult.draft,
    relationshipReviewPacket: packet,
    stage: "awaiting-independent-relationship-review",
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
