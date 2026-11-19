import { describe, expect, it, vi } from "vitest";
import { HOID_EDITORIAL_DRAFTS } from "./editorialDrafts";
import { HOID_EDITORIAL_CLAIM_DRAFTS } from "./editorialClaimDrafts";
import { HOID_EDITORIAL_ENTITY_DRAFTS } from "./editorialEntityDrafts";
import { HOID_EDITORIAL_RELATIONSHIP_DRAFTS } from "./editorialRelationshipDrafts";
import { buildHoidEditorialKnowledgeBundle } from "./editorialKnowledgeBundle";
import {
  buildHoidEditorialReviewBundle,
  type HoidEditorialReviewBundlePackets,
} from "./editorialReviewBundle";
import { createHoidReadingCursor } from "./readingManifest";
import { sha256Hex } from "./sha256";
import {
  buildHoidReviewerTrustRegistrySigningMessage,
  type HoidReviewerTrustKey,
  type HoidReviewerTrustRegistryUnsigned,
} from "./editorialReviewSignatures";
import { buildHoidEditorialBundlePromotionPlan } from "./editorialBundlePromotionAuthority";
import {
  authorizeHoidSignedEditorialBundlePromotion,
  buildHoidEditorialReviewPacketSigningMessage,
  type HoidEditorialBundleSignatureBatch,
} from "./signedEditorialBundlePromotionAuthority";
import type {
  HoidPromotionReviewRequest,
  HoidProtectedReviewFetchRequest,
  HoidProtectedReviewSnapshot,
} from "./promotionReviewAuthority";

const NOW = "2026-11-19T10:00:00.000Z";
const REVIEWED_AT = "2026-11-18T02:00:00.000Z";
const REPOSITORY = "Bhoa12/atlas-cosmere";
const rootKey = Object.freeze({ keyId: "root-2026", publicKeyHex: "11".repeat(32) });

function testSignature(message: string): string {
  const digest = sha256Hex("synthetic-signature-only:" + message);
  return digest + digest;
}

const reviewerKeys: readonly HoidReviewerTrustKey[] = Object.freeze([
  Object.freeze({
    keyId: "code-owner-key",
    reviewerId: "code-owner",
    algorithm: "Ed25519" as const,
    publicKeyHex: "22".repeat(32),
    status: "active" as const,
    validFrom: "2026-01-01T00:00:00.000Z",
    validUntil: "2027-01-01T00:00:00.000Z",
    revokedAt: null,
    allowedRepositoryFullNames: Object.freeze([REPOSITORY]),
  }),
  Object.freeze({
    keyId: "second-reviewer-key",
    reviewerId: "second-reviewer",
    algorithm: "Ed25519" as const,
    publicKeyHex: "33".repeat(32),
    status: "active" as const,
    validFrom: "2026-01-01T00:00:00.000Z",
    validUntil: "2027-01-01T00:00:00.000Z",
    revokedAt: null,
    allowedRepositoryFullNames: Object.freeze([REPOSITORY]),
  }),
]);

function createRegistry(keys: readonly HoidReviewerTrustKey[] = reviewerKeys) {
  const unsigned: HoidReviewerTrustRegistryUnsigned = Object.freeze({
    schemaVersion: 1,
    revision: 1,
    issuedAt: "2026-11-18T00:00:00.000Z",
    expiresAt: "2026-12-01T00:00:00.000Z",
    keys,
  });
  const message = buildHoidReviewerTrustRegistrySigningMessage(unsigned);
  if (message === null) throw new Error("Synthetic trust registry payload unavailable");
  return Object.freeze({
    ...unsigned,
    rootSignature: Object.freeze({
      algorithm: "Ed25519" as const,
      keyId: rootKey.keyId,
      signatureHex: testSignature(message),
    }),
  });
}

const fullSource = Object.freeze({
  summaries: HOID_EDITORIAL_DRAFTS,
  claims: HOID_EDITORIAL_CLAIM_DRAFTS,
  entities: HOID_EDITORIAL_ENTITY_DRAFTS,
  relationships: HOID_EDITORIAL_RELATIONSHIP_DRAFTS,
});
const fullKnowledge = buildHoidEditorialKnowledgeBundle(fullSource);
if (fullKnowledge.status !== "ready-for-review") throw new Error("Full knowledge fixture unavailable");
const fullReview = buildHoidEditorialReviewBundle(fullKnowledge.manifest, fullSource);
if (fullReview.status !== "ready-for-review") throw new Error("Full review fixture unavailable");

const resolvedSource = Object.freeze({
  summaries: HOID_EDITORIAL_DRAFTS,
  claims: HOID_EDITORIAL_CLAIM_DRAFTS,
  entities: HOID_EDITORIAL_ENTITY_DRAFTS.filter(item => item.identity.status === "resolved"),
  relationships: HOID_EDITORIAL_RELATIONSHIP_DRAFTS.filter(item =>
    item.subject.id !== "edgedancer.unnamed-girl" && item.object.id !== "edgedancer.unnamed-girl",
  ),
});
const resolvedKnowledge = buildHoidEditorialKnowledgeBundle(resolvedSource);
if (resolvedKnowledge.status !== "ready-for-review") throw new Error("Resolved knowledge fixture unavailable");
const resolvedReview = buildHoidEditorialReviewBundle(resolvedKnowledge.manifest, resolvedSource);
if (resolvedReview.status !== "ready-for-review") throw new Error("Resolved review fixture unavailable");

function approvedReceipts(packets: HoidEditorialReviewBundlePackets, fingerprint: string, allowUnresolved = false) {
  return {
    schemaVersion: 1,
    reviewBundleFingerprint: fingerprint,
    summaries: packets.summaries.map(packet => ({
      schemaVersion: 1,
      packetId: packet.packetId,
      draftId: packet.draftId,
      summarySha256: packet.summarySha256,
      sourceDocumentSha256: packet.sourceDocumentSha256,
      decision: "approved",
      reviewerId: "code-owner",
      reviewedAt: REVIEWED_AT,
      checklist: { factualAccuracy: true, completeness: true, originality: true, spoilerCeiling: true, provenance: true },
      noteCodes: ["no-issues"],
    })),
    claims: packets.claims.map(packet => ({
      schemaVersion: 1,
      packetId: packet.packetId,
      draftId: packet.draftId,
      claimSha256: packet.claimSha256,
      decision: "approved",
      reviewerId: "second-reviewer",
      reviewedAt: REVIEWED_AT,
      checklist: { factualAccuracy: true, atomicity: true, subjectIdentity: true, completeness: true, originality: true, spoilerCeiling: true, provenance: true },
      noteCodes: ["no-issues"],
    })),
    entities: packets.entities.map(packet => {
      const unresolved = packet.identity.status === "unresolved";
      const approved = !unresolved || allowUnresolved;
      return {
        schemaVersion: 1,
        packetId: packet.packetId,
        draftId: packet.draftId,
        identitySha256: packet.identitySha256,
        draftSha256: packet.draftSha256,
        decision: approved ? "approved" : "revision-required",
        reviewerId: "code-owner",
        reviewedAt: REVIEWED_AT,
        checklist: {
          factualAccuracy: approved,
          identityResolution: approved,
          uniqueness: true,
          completeness: true,
          spoilerCeiling: true,
          provenance: true,
        },
        noteCodes: approved ? ["no-issues"] : ["identity-issue"],
      };
    }),
    relationships: packets.relationships.map(packet => ({
      schemaVersion: 1,
      packetId: packet.packetId,
      draftId: packet.draftId,
      claimSha256: packet.claimSha256,
      decision: "approved",
      reviewerId: "second-reviewer",
      reviewedAt: REVIEWED_AT,
      checklist: { factualAccuracy: true, relationshipAccuracy: true, entityIdentity: true, completeness: true, originality: true, spoilerCeiling: true, provenance: true },
      noteCodes: ["no-issues"],
    })),
  };
}

function progressSnapshot(chapter = 5, revision = 17) {
  const cursor = createHoidReadingCursor("twok", chapter);
  if (cursor.status !== "ready") throw new Error("Progress fixture unavailable");
  return Object.freeze({
    schemaVersion: 2,
    revision,
    positions: Object.freeze([Object.freeze({ bookId: "twok", cursor: cursor.cursor })]),
    updatedAt: REVIEWED_AT,
  });
}

const initialProgress = progressSnapshot();
const request: HoidPromotionReviewRequest = Object.freeze({
  schemaVersion: 2,
  repositoryFullName: REPOSITORY,
  pullRequestNumber: 156,
  expectedBaseRef: "feat/hoid-ia-core-run155",
  expectedBaseSha: "b".repeat(40),
  expectedHeadRef: "feat/hoid-ia-core-run156",
  expectedHeadSha: "a".repeat(40),
  promotionManifestPath: "docs/hoid/editorial-bundle-promotion.json",
  minimumApprovals: 2,
  requireCodeOwnerReview: true,
  requireDismissStaleReviews: true,
  requireEnforcedAdmins: true,
});

function contextFor(reviewManifest: unknown, knowledgeManifest: unknown, source: unknown, receipts: unknown) {
  return Object.freeze({ reviewManifest, knowledgeManifest, source, receipts });
}

function buildFixture(singleReviewer = false) {
  const baseReceipts = approvedReceipts(resolvedReview.packets, resolvedReview.manifest.fingerprint);
  const receipts = singleReviewer
    ? {
        ...baseReceipts,
        claims: baseReceipts.claims.map(receipt => ({ ...receipt, reviewerId: "code-owner" })),
        relationships: baseReceipts.relationships.map(receipt => ({ ...receipt, reviewerId: "code-owner" })),
      }
    : baseReceipts;
  const built = buildHoidEditorialBundlePromotionPlan(
    resolvedReview.manifest,
    resolvedKnowledge.manifest,
    resolvedSource,
    receipts,
    initialProgress,
  );
  if (built.status !== "ready-for-protected-review") throw new Error("Signed promotion plan unavailable");

  const receiptArrays: Record<string, readonly any[]> = {
    summary: receipts.summaries,
    "atomic-claim": receipts.claims,
    entity: receipts.entities,
    relationship: receipts.relationships,
  };
  const signatures = built.plan.packets.map(packet => {
    const receipt = receiptArrays[packet.category].find(item => item.packetId === packet.packetId);
    if (!receipt) throw new Error("Synthetic packet receipt missing");
    const keyId = receipt.reviewerId === "code-owner" ? "code-owner-key" : "second-reviewer-key";
    const message = buildHoidEditorialReviewPacketSigningMessage(packet, receipt, built.plan, request, keyId);
    if (message === null) throw new Error("Synthetic packet signing message unavailable");
    return Object.freeze({
      category: packet.category,
      packetId: packet.packetId,
      keyId,
      signatureHex: testSignature(message),
    });
  });
  const signatureBatch: HoidEditorialBundleSignatureBatch = Object.freeze({
    schemaVersion: 1,
    reviewBundleFingerprint: built.plan.reviewBundleFingerprint,
    promotionPlanFingerprint: built.plan.fingerprint,
    receiptsFingerprint: built.plan.receiptsFingerprint,
    signatures: Object.freeze(signatures),
  });
  const verifier = Object.freeze({
    verify: async (input: { message: string; signatureHex: string }) =>
      input.signatureHex === testSignature(input.message),
  });
  return {
    plan: built.plan,
    receipts,
    context: contextFor(resolvedReview.manifest, resolvedKnowledge.manifest, resolvedSource, receipts),
    signatureBatch,
    registry: createRegistry(),
    verifier,
  };
}

function snapshotFor(fetchRequest: HoidProtectedReviewFetchRequest): HoidProtectedReviewSnapshot {
  return Object.freeze({
    schemaVersion: 2,
    repositoryFullName: REPOSITORY,
    pullRequestNumber: request.pullRequestNumber,
    state: "open",
    draft: false,
    baseRef: request.expectedBaseRef,
    baseSha: request.expectedBaseSha,
    headRef: request.expectedHeadRef,
    headSha: request.expectedHeadSha,
    authorId: "pull-request-author",
    promotionManifestPath: request.promotionManifestPath,
    promotionPlanFingerprint: fetchRequest.promotionPlanFingerprint,
    verifiedAt: "2026-11-19T10:01:00.000Z",
    branchProtection: Object.freeze({
      status: "verified",
      requiredApprovingReviewCount: 2,
      requireCodeOwnerReview: true,
      dismissStaleReviews: true,
      enforceAdmins: true,
    }),
    reviews: Object.freeze([
      Object.freeze({
        reviewId: "review-156-1",
        reviewerId: "code-owner",
        state: "APPROVED",
        commitSha: request.expectedHeadSha,
        submittedAt: "2026-11-19T09:50:00.000Z",
        dismissed: false,
        isCodeOwner: true,
      }),
      Object.freeze({
        reviewId: "review-156-2",
        reviewerId: "second-reviewer",
        state: "APPROVED",
        commitSha: request.expectedHeadSha,
        submittedAt: "2026-11-19T09:55:00.000Z",
        dismissed: false,
        isCodeOwner: false,
      }),
    ]),
  });
}

function sourceControlPort() {
  return {
    fetchProtectedReviewSnapshot: vi.fn(async (fetchRequest: HoidProtectedReviewFetchRequest) =>
      snapshotFor(fetchRequest)
    ),
  };
}

function progressPort(snapshots: readonly unknown[] = [initialProgress, initialProgress]) {
  let index = 0;
  return {
    readAuthoritativeProgressSnapshot: vi.fn(async () =>
      snapshots[Math.min(index++, snapshots.length - 1)]
    ),
  };
}

async function authorize(
  fixture = buildFixture(),
  overrides: Partial<{
    request: HoidPromotionReviewRequest;
    signatureBatch: HoidEditorialBundleSignatureBatch;
    registry: ReturnType<typeof createRegistry>;
    minimumRevision: number;
    progress: readonly unknown[];
  }> = {},
) {
  const source = sourceControlPort();
  const progress = progressPort(overrides.progress);
  const result = await authorizeHoidSignedEditorialBundlePromotion(
    fixture.plan,
    fixture.context,
    overrides.request ?? request,
    overrides.signatureBatch ?? fixture.signatureBatch,
    overrides.registry ?? fixture.registry,
    rootKey,
    fixture.verifier,
    NOW,
    overrides.minimumRevision ?? 1,
    initialProgress,
    source,
    progress,
  );
  return { result, source, progress };
}

describe("Hoid signed editorial bundle promotion", () => {
  it("requires a valid signature for every packet before protected review", async () => {
    const fixture = buildFixture();
    const { result, source, progress } = await authorize(fixture);
    expect(result).toMatchObject({
      status: "ready-for-maintainer-commit",
      baseSha: request.expectedBaseSha,
      verifiedReceiptCount: fixture.plan.packetCount,
      trustRegistryRevision: 1,
      promotionAllowed: false,
      productionWritePerformed: false,
    });
    expect(source.fetchProtectedReviewSnapshot).toHaveBeenCalledTimes(1);
    expect(progress.readAuthoritativeProgressSnapshot).toHaveBeenCalledTimes(2);
  });

  it("blocks a missing packet signature before source-control access", async () => {
    const fixture = buildFixture();
    const incomplete = Object.freeze({
      ...fixture.signatureBatch,
      signatures: Object.freeze(fixture.signatureBatch.signatures.slice(1)),
    });
    const { result, source } = await authorize(fixture, { signatureBatch: incomplete });
    expect(result).toMatchObject({ status: "blocked", reason: "invalid-signature-batch" });
    expect(source.fetchProtectedReviewSnapshot).not.toHaveBeenCalled();
  });

  it("rejects a signature replayed against another PR head", async () => {
    const fixture = buildFixture();
    const changedRequest = Object.freeze({ ...request, expectedHeadSha: "b".repeat(40) });
    const { result, source } = await authorize(fixture, { request: changedRequest });
    expect(result).toMatchObject({
      status: "blocked",
      reason: "signature-verification-failed",
      verificationReason: expect.stringContaining("signature-invalid"),
    });
    expect(source.fetchProtectedReviewSnapshot).not.toHaveBeenCalled();
  });

  it("rejects a rolled-back reviewer trust registry", async () => {
    const fixture = buildFixture();
    const { result, source } = await authorize(fixture, { minimumRevision: 2 });
    expect(result).toMatchObject({
      status: "blocked",
      reason: "signature-verification-failed",
      verificationReason: "registry-rollback",
    });
    expect(source.fetchProtectedReviewSnapshot).not.toHaveBeenCalled();
  });

  it("rejects a revoked reviewer key even when the signature is otherwise well-formed", async () => {
    const fixture = buildFixture();
    const revoked = reviewerKeys.map(key => key.keyId === "code-owner-key"
      ? Object.freeze({ ...key, status: "revoked" as const, revokedAt: "2026-11-18T12:00:00.000Z" })
      : key
    );
    const { result, source } = await authorize(fixture, { registry: createRegistry(revoked) });
    expect(result).toMatchObject({
      status: "blocked",
      reason: "signature-verification-failed",
      verificationReason: expect.stringContaining("key-revoked"),
    });
    expect(source.fetchProtectedReviewSnapshot).not.toHaveBeenCalled();
  });

  it("rejects a receipt batch changed after the plan was built", async () => {
    const fixture = buildFixture();
    const changedReceipts = {
      ...fixture.receipts,
      summaries: fixture.receipts.summaries.map((receipt, index) =>
        index === 0 ? { ...receipt, reviewerId: "different-reviewer" } : receipt
      ),
    };
    const changedContext = contextFor(
      resolvedReview.manifest,
      resolvedKnowledge.manifest,
      resolvedSource,
      changedReceipts,
    );
    const { result, source } = await authorize(Object.freeze({
      ...fixture,
      context: changedContext,
    }));
    expect(result).toMatchObject({ status: "blocked", reason: "editorial-bundle-changed" });
    expect(source.fetchProtectedReviewSnapshot).not.toHaveBeenCalled();
  });

  it("rechecks authoritative progress after signature verification", async () => {
    const fixture = buildFixture();
    const { result, source } = await authorize(fixture, {
      progress: [initialProgress, progressSnapshot(6, 18)],
    });
    expect(result).toMatchObject({ status: "blocked", reason: "progress-changed" });
    expect(source.fetchProtectedReviewSnapshot).toHaveBeenCalledTimes(1);
  });

  it("requires distinct signed reviewers to meet the protected approval quorum", async () => {
    const fixture = buildFixture(true);
    const { result, source } = await authorize(fixture);
    expect(result).toMatchObject({
      status: "blocked",
      reason: "insufficient-signed-reviewers",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
    expect(source.fetchProtectedReviewSnapshot).not.toHaveBeenCalled();
  });

  it("keeps unresolved identity receipts as a hard editorial blocker", async () => {
    const receipts = approvedReceipts(fullReview.packets, fullReview.manifest.fingerprint);
    const built = buildHoidEditorialBundlePromotionPlan(
      fullReview.manifest,
      fullKnowledge.manifest,
      fullSource,
      receipts,
      initialProgress,
    );
    expect(built).toMatchObject({
      status: "blocked",
      reason: "editorial-review-needs-revision",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  });

  it("binds each reviewer packet signature to the exact base commit SHA", () => {
    const fixture = buildFixture();
    const packet = fixture.plan.packets[0];
    const arrays: Record<string, readonly any[]> = {
      summary: fixture.receipts.summaries,
      "atomic-claim": fixture.receipts.claims,
      entity: fixture.receipts.entities,
      relationship: fixture.receipts.relationships,
    };
    const receipt = arrays[packet.category].find(item => item.packetId === packet.packetId);
    const signature = fixture.signatureBatch.signatures[0];
    const original = buildHoidEditorialReviewPacketSigningMessage(
      packet, receipt, fixture.plan, request, signature.keyId,
    );
    const changedBase = buildHoidEditorialReviewPacketSigningMessage(
      packet, receipt, fixture.plan, { ...request, expectedBaseSha: "c".repeat(40) }, signature.keyId,
    );
    expect(original).not.toBeNull();
    expect(changedBase).not.toBe(original);
  });


});
