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
import type { HoidTrustedHostPromotionInput, HoidTrustedHostPromotionResult } from "./trustedHostPromotionAuthority";
import type { HoidEditorialSourceDocumentAccessRequest } from "./editorialSourceDocumentAccess";
import { createHoidSourceBoundAtomicClaimPromotionGatePort } from "./sourceBoundAtomicClaimPromotionGate";

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
    positions: Object.freeze([Object.freeze({ bookId: "twok", cursor: cursor.cursor })]),
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
const reviewer = Object.freeze({ reviewerId: "editorial-reviewer", reviewedAt: REVIEWED_AT });

function claimBinding() {
  const core = Object.freeze({
    id: draft.id,
    text: draft.statement,
    intent: draft.intent,
    evidenceIds: Object.freeze([draft.subjectId]),
    entityIds: Object.freeze([draft.subjectId]),
    assertionKind: draft.assertionKind,
  });
  const attestation = createHoidExactApprovedClaimAttestation(
    core,
    [evidenceRecord],
    [policy],
    reviewer,
  );
  if (attestation.status !== "valid") throw new Error("Synthetic exact-unit claim attestation unavailable");
  const approvedClaim = Object.freeze({
    ...core,
    integrity: attestation.integrity,
    review: attestation.review,
  });
  return Object.freeze({
    approvedClaim,
    evidence: Object.freeze([evidenceRecord]),
    policies: Object.freeze([policy]),
    evidenceBindings: Object.freeze([Object.freeze({
      draftEvidenceIndex: 0,
      evidenceId: draft.subjectId,
    })]),
    subjectEvidenceId: draft.subjectId,
  });
}

function trustedHostInput(): HoidTrustedHostPromotionInput {
  return Object.freeze({
    plan: reviewKit.promotionPlan,
    context: Object.freeze({
      reviewManifest: reviewKit.reviewManifest,
      knowledgeManifest: reviewKit.knowledgeManifest,
      source: reviewKit.sourceInput,
      receipts: reviewKit.receipts,
    }),
    request: Object.freeze({
      schemaVersion: 2,
      repositoryFullName: reviewKit.context.repositoryFullName,
      pullRequestNumber: reviewKit.context.pullRequestNumber,
      expectedBaseRef: reviewKit.context.baseRef,
      expectedBaseSha: reviewKit.context.baseSha,
      expectedHeadRef: reviewKit.context.headRef,
      expectedHeadSha: reviewKit.context.headSha,
      promotionManifestPath: reviewKit.context.promotionManifestPath,
      minimumApprovals: 2,
      requireCodeOwnerReview: true,
      requireDismissStaleReviews: true,
      requireEnforcedAdmins: true,
    }),
    expectedRepositoryFullName: reviewKit.context.repositoryFullName,
  }) as unknown as HoidTrustedHostPromotionInput;
}

function sourcePort(
  inspect: (
    request: HoidEditorialSourceDocumentAccessRequest,
    call: number,
  ) => unknown = request => ({
    status: "available",
    documentSha256: request.expectedDocumentSha256,
  }),
) {
  let calls = 0;
  return Object.freeze({
    get calls() { return calls; },
    async inspectChapter(request: HoidEditorialSourceDocumentAccessRequest) {
      calls += 1;
      return inspect(request, calls);
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

describe("Hoid source-bound atomic-claim promotion gate", () => {
  it("re-inspects exact claim sources after trusted-host authorization", async () => {
    const source = sourcePort();
    const authorize = vi.fn(async () => hostReady);
    const gate = createHoidSourceBoundAtomicClaimPromotionGatePort({
      sourceAccessPort: source,
      trustedHostAuthority: authorize,
    });
    const result = await gate.authorize({
      trustedHostInput: trustedHostInput(),
      reviewKit,
      claimBindings: [claimBinding()],
    });

    expect(result.status).toBe("ready-for-maintainer-commit");
    expect(source.calls).toBe(2);
    expect(authorize).toHaveBeenCalledTimes(1);
    if (result.status !== "ready-for-maintainer-commit") return;
    expect(result.sourceInspectionPasses).toBe(2);
    expect(result.atomicClaimCount).toBe(1);
    expect(result.sourceDocumentsVerified).toBe(1);
    expect(result.promotionAllowed).toBe(false);
    expect(result.productionWritePerformed).toBe(false);
    expect(result.answerAuthorizationEffect).toBe("none");
    expect(result.spoilerUnlockEffect).toBe("none");
  });

  it("blocks when a source digest changes between the pre- and post-authorization inspections", async () => {
    const source = sourcePort((request, call) => ({
      status: "available",
      documentSha256: call === 1 ? request.expectedDocumentSha256 : "0".repeat(64),
    }));
    const authorize = vi.fn(async () => hostReady);
    const gate = createHoidSourceBoundAtomicClaimPromotionGatePort({
      sourceAccessPort: source,
      trustedHostAuthority: authorize,
    });
    const result = await gate.authorize({
      trustedHostInput: trustedHostInput(),
      reviewKit,
      claimBindings: [claimBinding()],
    });

    expect(result).toMatchObject({
      status: "blocked",
      reason: "preflight-blocked",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
    expect(source.calls).toBe(2);
    expect(authorize).toHaveBeenCalledTimes(1);
  });

  it("detects mutation of claim bindings while the trusted host is authorizing", async () => {
    const source = sourcePort();
    const bindings: unknown[] = [claimBinding()];
    const authorize = vi.fn(async () => {
      bindings.splice(0, 1);
      return hostReady;
    });
    const gate = createHoidSourceBoundAtomicClaimPromotionGatePort({
      sourceAccessPort: source,
      trustedHostAuthority: authorize,
    });
    const result = await gate.authorize({
      trustedHostInput: trustedHostInput(),
      reviewKit,
      claimBindings: bindings,
    });

    expect(result).toMatchObject({ status: "blocked", reason: "input-changed" });
    expect(source.calls).toBe(1);
    expect(authorize).toHaveBeenCalledTimes(1);
  });

  it("does not run a postflight when the trusted-host authority blocks", async () => {
    const source = sourcePort();
    const hostBlocked = Object.freeze({
      status: "blocked",
      reason: "bundle-review-quorum-blocked",
      promotionAllowed: false,
      productionWritePerformed: false,
    }) as unknown as HoidTrustedHostPromotionResult;
    const authorize = vi.fn(async () => hostBlocked);
    const gate = createHoidSourceBoundAtomicClaimPromotionGatePort({
      sourceAccessPort: source,
      trustedHostAuthority: authorize,
    });
    const result = await gate.authorize({
      trustedHostInput: trustedHostInput(),
      reviewKit,
      claimBindings: [claimBinding()],
    });

    expect(result).toMatchObject({ status: "blocked", reason: "trusted-host-blocked" });
    expect(source.calls).toBe(1);
  });

  it("rejects source-port output containing text, bytes or private paths", async () => {
    const source = sourcePort(request => ({
      status: "available",
      documentSha256: request.expectedDocumentSha256,
      text: "must-not-escape",
      bytes: [1, 2, 3],
      privatePath: "/private/cosmere.epub",
    }));
    const authorize = vi.fn(async () => hostReady);
    const gate = createHoidSourceBoundAtomicClaimPromotionGatePort({
      sourceAccessPort: source,
      trustedHostAuthority: authorize,
    });
    const result = await gate.authorize({
      trustedHostInput: trustedHostInput(),
      reviewKit,
      claimBindings: [claimBinding()],
    });

    expect(result).toMatchObject({ status: "blocked", reason: "preflight-blocked" });
    expect(JSON.stringify(result)).not.toContain("must-not-escape");
    expect(JSON.stringify(result)).not.toContain("/private/cosmere.epub");
    expect(authorize).not.toHaveBeenCalled();
  });

  it("fails closed on malformed outer input without reading a source or calling authority", async () => {
    const source = sourcePort();
    const authorize = vi.fn(async () => hostReady);
    const gate = createHoidSourceBoundAtomicClaimPromotionGatePort({
      sourceAccessPort: source,
      trustedHostAuthority: authorize,
    });
    const hostile = Object.defineProperty({}, "reviewKit", {
      enumerable: true,
      get() {
        throw new Error("getter must not execute");
      },
    });
    const result = await gate.authorize(hostile);

    expect(result).toMatchObject({ status: "blocked", reason: "invalid-input" });
    expect(source.calls).toBe(0);
    expect(authorize).not.toHaveBeenCalled();
  });

  it("returns only aggregate metadata and never includes claim prose or source locators", async () => {
    const source = sourcePort();
    const gate = createHoidSourceBoundAtomicClaimPromotionGatePort({
      sourceAccessPort: source,
      trustedHostAuthority: async () => hostReady,
    });
    const result = await gate.authorize({
      trustedHostInput: trustedHostInput(),
      reviewKit,
      claimBindings: [claimBinding()],
    });

    expect(result.status).toBe("ready-for-maintainer-commit");
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(draft.statement);
    expect(serialized).not.toContain(sourceEvidence.source.locatorId);
    expect(serialized).not.toContain(sourceEvidence.sourceIntegrity.documentSha256);
    expect(serialized).not.toContain("cosmere.epub");
  });
});
