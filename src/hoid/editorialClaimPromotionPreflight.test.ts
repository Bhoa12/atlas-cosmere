import { describe, expect, it, vi } from "vitest";
import { HOID_EDITORIAL_DRAFTS } from "./editorialDrafts";
import { HOID_EDITORIAL_CLAIM_DRAFTS, type HoidEditorialClaimDraft } from "./editorialClaimDrafts";
import { HOID_EDITORIAL_ENTITY_DRAFTS } from "./editorialEntityDrafts";
import { HOID_EDITORIAL_RELATIONSHIP_DRAFTS } from "./editorialRelationshipDrafts";
import { buildHoidEditorialKnowledgeBundle } from "./editorialKnowledgeBundle";
import { buildHoidEditorialReviewBundle } from "./editorialReviewBundle";
import { buildHoidEditorialReviewKit } from "./editorialReviewKit";
import { createHoidReadingCursor } from "./readingManifest";
import { createHoidChapterReference } from "./chapterReference";
import {
  createHoidExactApprovedClaimAttestation,
  type HoidExactEvidenceRecord,
} from "./exactUnitClaimIntegrity";
import type { HoidExactUnitEvidencePolicy } from "./unitEvidenceAuthorizationV2";
import type {
  HoidTrustedHostPromotionInput,
  HoidTrustedHostPromotionResult,
} from "./trustedHostPromotionAuthority";
import {
  createHoidTrustedHostClaimPromotionAdapter,
  type HoidEditorialSourceDocumentAccessRequest,
} from "./editorialClaimPromotionPreflight";

const REVIEWED_AT = "2026-11-25T18:00:00.000Z";
const REPOSITORY = "Bhoa12/atlas-cosmere";
const sourceInput = Object.freeze({
  summaries: HOID_EDITORIAL_DRAFTS,
  claims: HOID_EDITORIAL_CLAIM_DRAFTS,
  entities: HOID_EDITORIAL_ENTITY_DRAFTS.filter(item => item.identity.status === "resolved"),
  relationships: HOID_EDITORIAL_RELATIONSHIP_DRAFTS.filter(item =>
    item.subject.id !== "edgedancer.unnamed-girl" &&
    item.object.id !== "edgedancer.unnamed-girl",
  ),
});
const knowledgeResult = buildHoidEditorialKnowledgeBundle(sourceInput);
if (knowledgeResult.status !== "ready-for-review") throw new Error("Knowledge fixture unavailable");
const reviewResult = buildHoidEditorialReviewBundle(knowledgeResult.manifest, sourceInput);
if (reviewResult.status !== "ready-for-review") throw new Error("Review fixture unavailable");
const reviewManifest = reviewResult.manifest;
const packets = reviewResult.packets;

function progressSnapshot(revision = 17) {
  const cursor = createHoidReadingCursor("twok", 5);
  if (cursor.status !== "ready") throw new Error("Progress fixture unavailable");
  return Object.freeze({
    schemaVersion: 2,
    revision,
    positions: Object.freeze([
      Object.freeze({ bookId: "twok", cursor: cursor.cursor }),
    ]),
    updatedAt: REVIEWED_AT,
  });
}

function approvedReceipts() {
  return Object.freeze({
    schemaVersion: 1,
    reviewBundleFingerprint: reviewManifest.fingerprint,
    summaries: Object.freeze(packets.summaries.map(packet => ({
      schemaVersion: 1,
      packetId: packet.packetId,
      draftId: packet.draftId,
      summarySha256: packet.summarySha256,
      sourceDocumentSha256: packet.sourceDocumentSha256,
      decision: "approved",
      reviewerId: "summary-reviewer",
      reviewedAt: REVIEWED_AT,
      checklist: {
        factualAccuracy: true,
        completeness: true,
        originality: true,
        spoilerCeiling: true,
        provenance: true,
      },
      noteCodes: ["no-issues"],
    }))),
    claims: Object.freeze(packets.claims.map(packet => ({
      schemaVersion: 1,
      packetId: packet.packetId,
      draftId: packet.draftId,
      claimSha256: packet.claimSha256,
      decision: "approved",
      reviewerId: "claim-reviewer",
      reviewedAt: REVIEWED_AT,
      checklist: {
        factualAccuracy: true,
        atomicity: true,
        subjectIdentity: true,
        completeness: true,
        originality: true,
        spoilerCeiling: true,
        provenance: true,
      },
      noteCodes: ["no-issues"],
    }))),
    entities: Object.freeze(packets.entities.map(packet => ({
      schemaVersion: 1,
      packetId: packet.packetId,
      draftId: packet.draftId,
      identitySha256: packet.identitySha256,
      draftSha256: packet.draftSha256,
      decision: "approved",
      reviewerId: "entity-reviewer",
      reviewedAt: REVIEWED_AT,
      checklist: {
        factualAccuracy: true,
        identityResolution: true,
        uniqueness: true,
        completeness: true,
        spoilerCeiling: true,
        provenance: true,
      },
      noteCodes: ["no-issues"],
    }))),
    relationships: Object.freeze(packets.relationships.map(packet => ({
      schemaVersion: 1,
      packetId: packet.packetId,
      draftId: packet.draftId,
      claimSha256: packet.claimSha256,
      decision: "approved",
      reviewerId: "relationship-reviewer",
      reviewedAt: REVIEWED_AT,
      checklist: {
        factualAccuracy: true,
        relationshipAccuracy: true,
        entityIdentity: true,
        completeness: true,
        originality: true,
        spoilerCeiling: true,
        provenance: true,
      },
      noteCodes: ["no-issues"],
    }))),
  });
}

const context = Object.freeze({
  repositoryFullName: REPOSITORY,
  pullRequestNumber: 212,
  baseRef: "feat/hoid-ia-core-run318",
  baseSha: "6b604c724c3c5bfaeac7fdd7504e83f7e9898c31",
  headRef: "feat/hoid-ia-core-run319",
  headSha: "c".repeat(40),
  promotionManifestPath: "docs/hoid/EDITORIAL_PROMOTION_MANIFEST.json",
});
const reviewKitBuild = buildHoidEditorialReviewKit({
  knowledgeManifest: knowledgeResult.manifest,
  sourceInput,
  receipts: approvedReceipts(),
  progressSnapshot: progressSnapshot(),
  context,
});
if (reviewKitBuild.status !== "ready") throw new Error("Review kit fixture unavailable");
const reviewKit = reviewKitBuild.kit;
const draft = HOID_EDITORIAL_CLAIM_DRAFTS[0] as HoidEditorialClaimDraft;
const sourceEvidence = draft.evidence[0];

function chapterReference(bookId: string, chapterNumber: number) {
  const result = createHoidChapterReference(bookId, { chapterNumber });
  if (result.status !== "ready") throw new Error("Exact chapter reference unavailable");
  return result.reference;
}

const sourceReference = chapterReference(sourceEvidence.source.bookId, sourceEvidence.source.chapter);
const unlockReference = chapterReference(sourceEvidence.unlock.bookId, sourceEvidence.unlock.chapter);
const evidenceRecord: HoidExactEvidenceRecord = Object.freeze({
  id: draft.subjectId,
  aliases: Object.freeze(["Entidad sintética"]),
  kind: draft.subjectKind,
  provenance: "verified",
  summary: "Resumen editorial sintético para pruebas.",
});
const policy: HoidExactUnitEvidencePolicy = Object.freeze({
  schemaVersion: 2,
  evidenceId: draft.subjectId,
  source: sourceReference,
  firstSafeAppearance: sourceReference,
  unlock: unlockReference,
});
const reviewer = Object.freeze({
  reviewerId: "editorial-reviewer",
  reviewedAt: REVIEWED_AT,
});

function approvedClaim(assertionKind: string | null = draft.assertionKind) {
  const core = Object.freeze({
    id: draft.id,
    text: draft.statement,
    intent: draft.intent,
    evidenceIds: Object.freeze([draft.subjectId]),
    entityIds: Object.freeze([draft.subjectId]),
    ...(assertionKind === null ? {} : { assertionKind }),
  });
  const result = createHoidExactApprovedClaimAttestation(core, [evidenceRecord], [policy], reviewer);
  if (result.status !== "valid") throw new Error("Synthetic exact-unit claim attestation unavailable");
  return Object.freeze({
    ...core,
    integrity: result.integrity,
    review: result.review,
  });
}

function claimBinding(
  assertionKind: string | null = draft.assertionKind,
  evidenceId = draft.subjectId,
  evidenceIndex = 0,
) {
  const claim = approvedClaim(assertionKind);
  const evidence = Object.freeze({
    ...evidenceRecord,
    id: evidenceId,
  });
  const evidencePolicy = Object.freeze({
    ...policy,
    evidenceId,
  });
  return Object.freeze({
    approvedClaim: claim,
    evidence: Object.freeze([evidence]),
    policies: Object.freeze([evidencePolicy]),
    evidenceBindings: Object.freeze([Object.freeze({
      draftEvidenceIndex: evidenceIndex,
      evidenceId,
    })]),
    subjectEvidenceId: draft.subjectId,
  });
}

function trustedHostInput(kit = reviewKit): HoidTrustedHostPromotionInput {
  return Object.freeze({
    plan: kit.promotionPlan,
    context: Object.freeze({
      reviewManifest: kit.reviewManifest,
      knowledgeManifest: kit.knowledgeManifest,
      source: kit.sourceInput,
      receipts: kit.receipts,
    }),
    request: Object.freeze({
      schemaVersion: 2,
      repositoryFullName: kit.context.repositoryFullName,
      pullRequestNumber: kit.context.pullRequestNumber,
      expectedBaseRef: kit.context.baseRef,
      expectedBaseSha: kit.context.baseSha,
      expectedHeadRef: kit.context.headRef,
      expectedHeadSha: kit.context.headSha,
      promotionManifestPath: kit.context.promotionManifestPath,
      minimumApprovals: 2,
      requireCodeOwnerReview: true,
      requireDismissStaleReviews: true,
      requireEnforcedAdmins: true,
    }),
    expectedRepositoryFullName: kit.context.repositoryFullName,
  }) as unknown as HoidTrustedHostPromotionInput;
}

function sourcePort(
  inspect?: (request: HoidEditorialSourceDocumentAccessRequest) => unknown,
) {
  return Object.freeze({
    async inspectChapter(request: HoidEditorialSourceDocumentAccessRequest) {
      return inspect
        ? inspect(request)
        : Object.freeze({
            status: "available",
            documentSha256: request.expectedDocumentSha256,
          });
    },
  });
}

const hostReady = Object.freeze({
  status: "ready-for-maintainer-commit",
  authorization: Object.freeze({ status: "ready-for-maintainer-commit" }),
  bundleReviewQuorum: Object.freeze({ status: "verified" }),
  bootstrapFingerprint: "a".repeat(64),
  configuredMinimumRegistryRevision: 1,
  persistedMinimumRegistryRevision: 1,
  promotionAllowed: false,
  productionWritePerformed: false,
}) as unknown as HoidTrustedHostPromotionResult;

describe("Hoid claim promotion parity preflight", () => {
  it("requires exact parity from draft through review packet to approved claim before trusted-host authorization", async () => {
    const authorizer = vi.fn(async () => hostReady);
    const adapter = createHoidTrustedHostClaimPromotionAdapter(sourcePort(), authorizer);
    const result = await adapter.authorize({
      trustedHostInput: trustedHostInput(),
      reviewKit,
      claimBindings: [claimBinding()],
    });

    expect(result.status).toBe("ready-for-maintainer-commit");
    expect(authorizer).toHaveBeenCalledTimes(1);
    if (result.status !== "ready-for-maintainer-commit") return;
    expect(result.parityAudit.atomicClaimCount).toBe(1);
    expect(result.parityAudit.sourceDocumentsVerified).toBe(1);
    expect(result.promotionAllowed).toBe(false);
    expect(result.productionWritePerformed).toBe(false);
  });

  it("blocks an approved claim whose assertion kind differs from the reviewed draft", async () => {
    const authorizer = vi.fn(async () => hostReady);
    const adapter = createHoidTrustedHostClaimPromotionAdapter(sourcePort(), authorizer);
    const result = await adapter.authorize({
      trustedHostInput: trustedHostInput(),
      reviewKit,
      claimBindings: [claimBinding("interpretation")],
    });

    expect(result).toMatchObject({
      status: "blocked",
      reason: "claim-parity-preflight-blocked",
      parityAudit: { status: "blocked", reason: "epistemic-classification-mismatch" },
    });
    expect(authorizer).not.toHaveBeenCalled();
  });

  it("blocks legacy approved claims that have no epistemic classification", async () => {
    const authorizer = vi.fn(async () => hostReady);
    const adapter = createHoidTrustedHostClaimPromotionAdapter(sourcePort(), authorizer);
    const result = await adapter.authorize({
      trustedHostInput: trustedHostInput(),
      reviewKit,
      claimBindings: [claimBinding(null)],
    });

    expect(result).toMatchObject({
      status: "blocked",
      parityAudit: { status: "blocked", reason: "unclassified-approved-claim" },
    });
    expect(authorizer).not.toHaveBeenCalled();
  });

  it("blocks when the local source document is not mounted", async () => {
    const authorizer = vi.fn(async () => hostReady);
    const adapter = createHoidTrustedHostClaimPromotionAdapter(
      sourcePort(() => ({ status: "unavailable", reason: "not-mounted" })),
      authorizer,
    );
    const result = await adapter.authorize({
      trustedHostInput: trustedHostInput(),
      reviewKit,
      claimBindings: [claimBinding()],
    });

    expect(result).toMatchObject({
      status: "blocked",
      parityAudit: { status: "blocked", reason: "source-unavailable" },
    });
    expect(authorizer).not.toHaveBeenCalled();
  });

  it("blocks when the locally inspected document digest differs from the registered digest", async () => {
    const authorizer = vi.fn(async () => hostReady);
    const adapter = createHoidTrustedHostClaimPromotionAdapter(
      sourcePort(() => ({ status: "available", documentSha256: "0".repeat(64) })),
      authorizer,
    );
    const result = await adapter.authorize({
      trustedHostInput: trustedHostInput(),
      reviewKit,
      claimBindings: [claimBinding()],
    });

    expect(result).toMatchObject({
      status: "blocked",
      parityAudit: { status: "blocked", reason: "source-digest-mismatch" },
    });
    expect(authorizer).not.toHaveBeenCalled();
  });

  it("blocks incomplete or duplicated evidence-index mappings", async () => {
    const authorizer = vi.fn(async () => hostReady);
    const adapter = createHoidTrustedHostClaimPromotionAdapter(sourcePort(), authorizer);
    const result = await adapter.authorize({
      trustedHostInput: trustedHostInput(),
      reviewKit,
      claimBindings: [claimBinding(draft.assertionKind, draft.subjectId, 1)],
    });

    expect(result).toMatchObject({
      status: "blocked",
      parityAudit: { status: "blocked", reason: "evidence-binding-mismatch" },
    });
    expect(authorizer).not.toHaveBeenCalled();
  });

  it("blocks when the subject evidence identity or kind does not match the draft", async () => {
    const authorizer = vi.fn(async () => hostReady);
    const binding = {
      ...claimBinding(),
      subjectEvidenceId: "different.subject",
    };
    const adapter = createHoidTrustedHostClaimPromotionAdapter(sourcePort(), authorizer);
    const result = await adapter.authorize({
      trustedHostInput: trustedHostInput(),
      reviewKit,
      claimBindings: [binding],
    });

    expect(result).toMatchObject({
      status: "blocked",
      parityAudit: { status: "blocked", reason: "subject-binding-mismatch" },
    });
    expect(authorizer).not.toHaveBeenCalled();
  });

  it("binds the review kit to the exact trusted-host PR, plan and source context", async () => {
    const authorizer = vi.fn(async () => hostReady);
    const base = trustedHostInput();
    const baseRequest = base.request as Record<string, unknown>;
    const stale = {
      ...base,
      request: {
        ...baseRequest,
        expectedHeadSha: "d".repeat(40),
      },
    } as unknown as HoidTrustedHostPromotionInput;
    const adapter = createHoidTrustedHostClaimPromotionAdapter(sourcePort(), authorizer);
    const result = await adapter.authorize({
      trustedHostInput: stale,
      reviewKit,
      claimBindings: [claimBinding()],
    });

    expect(result).toMatchObject({
      status: "blocked",
      reason: "trusted-host-context-mismatch",
    });
    expect(authorizer).not.toHaveBeenCalled();
  });

  it("rejects an accessor-backed source port without invoking its getter", async () => {
    let invoked = false;
    const hostile = Object.defineProperty({}, "inspectChapter", {
      enumerable: true,
      get() {
        invoked = true;
        return async () => ({ status: "available", documentSha256: "a".repeat(64) });
      },
    });
    const authorizer = vi.fn(async () => hostReady);
    const adapter = createHoidTrustedHostClaimPromotionAdapter(
      hostile as never,
      authorizer,
    );
    const result = await adapter.authorize({
      trustedHostInput: trustedHostInput(),
      reviewKit,
      claimBindings: [claimBinding()],
    });

    expect(result).toMatchObject({
      status: "blocked",
      parityAudit: { status: "blocked", reason: "source-access-port-invalid" },
    });
    expect(invoked).toBe(false);
    expect(authorizer).not.toHaveBeenCalled();
  });

  it("delegates to the trusted host only after parity, and preserves its fail-closed result", async () => {
    const hostBlocked = Object.freeze({
      status: "blocked",
      reason: "bundle-review-quorum-blocked",
      promotionAllowed: false,
      productionWritePerformed: false,
    }) as unknown as HoidTrustedHostPromotionResult;
    const authorizer = vi.fn(async () => hostBlocked);
    const adapter = createHoidTrustedHostClaimPromotionAdapter(sourcePort(), authorizer);
    const result = await adapter.authorize({
      trustedHostInput: trustedHostInput(),
      reviewKit,
      claimBindings: [claimBinding()],
    });

    expect(result).toMatchObject({
      status: "blocked",
      reason: "trusted-host-blocked",
      parityAudit: { status: "ready-for-trusted-host" },
      trustedHostResult: { status: "blocked", reason: "bundle-review-quorum-blocked" },
      promotionAllowed: false,
      productionWritePerformed: false,
    });
    expect(authorizer).toHaveBeenCalledTimes(1);
  });

  it("rejects a tampered review kit before any source read or trusted-host call", async () => {
    const firstClaim = reviewKit.sourceInput.claims[0] as Record<string, unknown>;
    const tampered = {
      ...reviewKit,
      sourceInput: {
        ...reviewKit.sourceInput,
        claims: [{ ...firstClaim, statement: String(firstClaim.statement) + " altered" }],
      },
    };
    const inspect = vi.fn(async (request: HoidEditorialSourceDocumentAccessRequest) => ({
      status: "available",
      documentSha256: request.expectedDocumentSha256,
    }));
    const authorizer = vi.fn(async () => hostReady);
    const adapter = createHoidTrustedHostClaimPromotionAdapter(sourcePort(inspect), authorizer);
    const result = await adapter.authorize({
      trustedHostInput: trustedHostInput(),
      reviewKit: tampered,
      claimBindings: [claimBinding()],
    });

    expect(result).toMatchObject({
      status: "blocked",
      reason: "claim-parity-preflight-blocked",
      parityAudit: { status: "blocked", reason: "invalid-review-kit" },
    });
    expect(inspect).not.toHaveBeenCalled();
    expect(authorizer).not.toHaveBeenCalled();
  });

  it("sends metadata and expected digest to the source port, never passage text or EPUB bytes", async () => {
    const inspect = vi.fn(async (request: HoidEditorialSourceDocumentAccessRequest) => {
      expect(Object.keys(request).sort()).toEqual([
        "bookId",
        "chapterNumber",
        "editionId",
        "expectedDocumentSha256",
        "locatorId",
        "navigationSha256",
      ]);
      expect(request).not.toHaveProperty("text");
      expect(request).not.toHaveProperty("bytes");
      return { status: "available", documentSha256: request.expectedDocumentSha256 };
    });
    const authorizer = vi.fn(async () => hostReady);
    const adapter = createHoidTrustedHostClaimPromotionAdapter(sourcePort(inspect), authorizer);
    const result = await adapter.authorize({
      trustedHostInput: trustedHostInput(),
      reviewKit,
      claimBindings: [claimBinding()],
    });

    expect(result.status).toBe("ready-for-maintainer-commit");
    expect(inspect).toHaveBeenCalledTimes(1);
  });
});
