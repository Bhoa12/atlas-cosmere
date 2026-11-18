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
import {
  authorizeHoidEditorialBundlePromotion,
  buildHoidEditorialBundlePromotionPlan,
  validateHoidEditorialBundlePromotionPlan,
  type HoidEditorialBundlePromotionContext,
  type HoidEditorialBundlePromotionPlan,
} from "./editorialBundlePromotionAuthority";
import type {
  HoidPromotionReviewRequest,
  HoidProtectedReviewFetchRequest,
  HoidProtectedReviewSnapshot,
} from "./promotionReviewAuthority";

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

const resolvedEntities = HOID_EDITORIAL_ENTITY_DRAFTS.filter(item => item.identity.status === "resolved");
const resolvedRelationships = HOID_EDITORIAL_RELATIONSHIP_DRAFTS.filter(item =>
  item.subject.id !== "edgedancer.unnamed-girl" && item.object.id !== "edgedancer.unnamed-girl",
);
const resolvedSource = Object.freeze({
  summaries: HOID_EDITORIAL_DRAFTS,
  claims: HOID_EDITORIAL_CLAIM_DRAFTS,
  entities: resolvedEntities,
  relationships: resolvedRelationships,
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
      reviewerId: "summary-reviewer",
      reviewedAt: "2026-11-18T02:00:00.000Z",
      checklist: {
        factualAccuracy: true,
        completeness: true,
        originality: true,
        spoilerCeiling: true,
        provenance: true,
      },
      noteCodes: ["no-issues"],
    })),
    claims: packets.claims.map(packet => ({
      schemaVersion: 1,
      packetId: packet.packetId,
      draftId: packet.draftId,
      claimSha256: packet.claimSha256,
      decision: "approved",
      reviewerId: "claim-reviewer",
      reviewedAt: "2026-11-18T02:00:00.000Z",
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
        reviewerId: "entity-reviewer",
        reviewedAt: "2026-11-18T02:00:00.000Z",
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
      reviewerId: "relationship-reviewer",
      reviewedAt: "2026-11-18T02:00:00.000Z",
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
    })),
  };
}

function progressSnapshot(chapter = 5, revision = 17) {
  const cursor = createHoidReadingCursor("twok", chapter);
  if (cursor.status !== "ready") throw new Error("Progress fixture unavailable");
  return Object.freeze({
    schemaVersion: 2,
    revision,
    positions: Object.freeze([
      Object.freeze({ bookId: "twok", cursor: cursor.cursor }),
    ]),
    updatedAt: "2026-11-18T02:00:00.000Z",
  });
}

const initialProgress = progressSnapshot();
const request: HoidPromotionReviewRequest = Object.freeze({
  schemaVersion: 1,
  repositoryFullName: "Bhoa12/atlas-cosmere",
  pullRequestNumber: 123,
  expectedBaseRef: "feat/hoid-ia-core-run122",
  expectedHeadRef: "feat/hoid-ia-core-run123",
  expectedHeadSha: "a".repeat(40),
  promotionManifestPath: "docs/hoid/editorial-bundle-promotion.json",
  minimumApprovals: 2,
  requireCodeOwnerReview: true,
  requireDismissStaleReviews: true,
  requireEnforcedAdmins: true,
});

function contextFor(
  reviewManifest: unknown,
  knowledgeManifest: unknown,
  source: unknown,
  receipts: unknown,
): HoidEditorialBundlePromotionContext {
  return Object.freeze({ reviewManifest, knowledgeManifest, source, receipts });
}

function buildResolvedPlan() {
  const receipts = approvedReceipts(resolvedReview.packets, resolvedReview.manifest.fingerprint);
  const result = buildHoidEditorialBundlePromotionPlan(
    resolvedReview.manifest,
    resolvedKnowledge.manifest,
    resolvedSource,
    receipts,
    initialProgress,
  );
  if (result.status !== "ready-for-protected-review") {
    throw new Error("Resolved editorial promotion fixture unavailable");
  }
  return { plan: result.plan, receipts };
}

function snapshotFor(fetchRequest: HoidProtectedReviewFetchRequest): HoidProtectedReviewSnapshot {
  return Object.freeze({
    schemaVersion: 1,
    repositoryFullName: request.repositoryFullName,
    pullRequestNumber: request.pullRequestNumber,
    state: "open",
    draft: false,
    baseRef: request.expectedBaseRef,
    headRef: request.expectedHeadRef,
    headSha: request.expectedHeadSha,
    authorId: "pull-request-author",
    promotionManifestPath: request.promotionManifestPath,
    promotionPlanFingerprint: fetchRequest.promotionPlanFingerprint,
    verifiedAt: "2026-11-18T02:10:00.000Z",
    branchProtection: Object.freeze({
      status: "verified",
      requiredApprovingReviewCount: 2,
      requireCodeOwnerReview: true,
      dismissStaleReviews: true,
      enforceAdmins: true,
    }),
    reviews: Object.freeze([
      Object.freeze({
        reviewId: "review-101",
        reviewerId: "code-owner",
        state: "APPROVED",
        commitSha: request.expectedHeadSha,
        submittedAt: "2026-11-18T02:05:00.000Z",
        dismissed: false,
        isCodeOwner: true,
      }),
      Object.freeze({
        reviewId: "review-102",
        reviewerId: "second-reviewer",
        state: "APPROVED",
        commitSha: request.expectedHeadSha,
        submittedAt: "2026-11-18T02:06:00.000Z",
        dismissed: false,
        isCodeOwner: false,
      }),
    ]),
  });
}

function sourceControlPort(mutate: (snapshot: HoidProtectedReviewSnapshot) => unknown = value => value) {
  return {
    fetchProtectedReviewSnapshot: vi.fn(async (fetchRequest: HoidProtectedReviewFetchRequest) =>
      mutate(snapshotFor(fetchRequest))
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

describe("Hoid complete editorial bundle promotion authority", () => {
  it("builds a deterministic plan only from a complete approved four-category review", () => {
    const { plan, receipts } = buildResolvedPlan();
    const rebuilt = buildHoidEditorialBundlePromotionPlan(
      resolvedReview.manifest,
      resolvedKnowledge.manifest,
      resolvedSource,
      receipts,
      initialProgress,
    );
    expect(rebuilt.status).toBe("ready-for-protected-review");
    if (rebuilt.status !== "ready-for-protected-review") return;
    expect(rebuilt.plan).toEqual(plan);
    expect(plan.packetCount).toBe(42);
    expect(plan.packets).toHaveLength(42);
    expect(plan.promotionAllowed).toBe(false);
    expect(plan.productionWritePerformed).toBe(false);
  });

  it("keeps the real unresolved identity as a review blocker", () => {
    const receipts = approvedReceipts(fullReview.packets, fullReview.manifest.fingerprint);
    const result = buildHoidEditorialBundlePromotionPlan(
      fullReview.manifest,
      fullKnowledge.manifest,
      fullSource,
      receipts,
      initialProgress,
    );
    expect(result).toMatchObject({
      status: "blocked",
      reason: "editorial-review-needs-revision",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  });

  it("does not build a plan when any review receipt is missing", () => {
    const { receipts } = buildResolvedPlan();
    const incomplete = { ...receipts, summaries: receipts.summaries.slice(1) };
    expect(buildHoidEditorialBundlePromotionPlan(
      resolvedReview.manifest,
      resolvedKnowledge.manifest,
      resolvedSource,
      incomplete,
      initialProgress,
    )).toMatchObject({ status: "blocked", reason: "editorial-review-incomplete" });
  });

  it("rejects altered plan fingerprints and unexpected plan fields", () => {
    const { plan } = buildResolvedPlan();
    expect(validateHoidEditorialBundlePromotionPlan(plan)).toMatchObject({ status: "valid" });
    expect(validateHoidEditorialBundlePromotionPlan({
      ...plan,
      fingerprint: "f".repeat(64),
    })).toEqual({ status: "invalid", reason: "plan-fingerprint-mismatch" });
    expect(validateHoidEditorialBundlePromotionPlan({
      ...plan,
      promotionAllowed: true,
    })).toEqual({ status: "invalid", reason: "invalid-plan" });
  });

  it("authorizes only the exact complete bundle, protected PR head and unchanged SQLite progress", async () => {
    const { plan, receipts } = buildResolvedPlan();
    const source = sourceControlPort();
    const progress = progressPort();
    const result = await authorizeHoidEditorialBundlePromotion(
      plan,
      contextFor(resolvedReview.manifest, resolvedKnowledge.manifest, resolvedSource, receipts),
      request,
      source,
      progress,
    );
    expect(result).toMatchObject({
      status: "ready-for-maintainer-commit",
      reviewBundleFingerprint: plan.reviewBundleFingerprint,
      receiptsFingerprint: plan.receiptsFingerprint,
      protectedReviewVerified: true,
      editorialReviewComplete: true,
      promotionAllowed: false,
      productionWritePerformed: false,
    });
    expect(source.fetchProtectedReviewSnapshot).toHaveBeenCalledTimes(1);
    expect(progress.readAuthoritativeProgressSnapshot).toHaveBeenCalledTimes(2);
  });

  it("blocks when progress changes while protected reviews are being fetched", async () => {
    const { plan, receipts } = buildResolvedPlan();
    const result = await authorizeHoidEditorialBundlePromotion(
      plan,
      contextFor(resolvedReview.manifest, resolvedKnowledge.manifest, resolvedSource, receipts),
      request,
      sourceControlPort(),
      progressPort([initialProgress, progressSnapshot(6, 18)]),
    );
    expect(result).toMatchObject({
      status: "blocked",
      reason: "progress-changed",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  });

  it("blocks when the source-control snapshot references another bundle plan", async () => {
    const { plan, receipts } = buildResolvedPlan();
    const result = await authorizeHoidEditorialBundlePromotion(
      plan,
      contextFor(resolvedReview.manifest, resolvedKnowledge.manifest, resolvedSource, receipts),
      request,
      sourceControlPort(snapshot => ({
        ...snapshot,
        promotionPlanFingerprint: "f".repeat(64),
      })),
      progressPort(),
    );
    expect(result).toMatchObject({
      status: "blocked",
      reason: "review-not-satisfied",
      verificationReason: "promotion-plan-mismatch",
    });
  });

  it("rebuilds receipts before source-control access and rejects a changed receipt batch", async () => {
    const { plan, receipts } = buildResolvedPlan();
    const changed = {
      ...receipts,
      summaries: receipts.summaries.map((receipt, index) =>
        index === 0 ? { ...receipt, reviewerId: "different-reviewer" } : receipt,
      ),
    };
    const source = sourceControlPort();
    const result = await authorizeHoidEditorialBundlePromotion(
      plan,
      contextFor(resolvedReview.manifest, resolvedKnowledge.manifest, resolvedSource, changed),
      request,
      source,
      progressPort(),
    );
    expect(result).toMatchObject({ status: "blocked", reason: "editorial-bundle-changed" });
    expect(source.fetchProtectedReviewSnapshot).not.toHaveBeenCalled();
  });

  it("blocks when the live progress is already stale before contacting GitHub", async () => {
    const { plan, receipts } = buildResolvedPlan();
    const source = sourceControlPort();
    const result = await authorizeHoidEditorialBundlePromotion(
      plan,
      contextFor(resolvedReview.manifest, resolvedKnowledge.manifest, resolvedSource, receipts),
      request,
      source,
      progressPort([progressSnapshot(6, 18)]),
    );
    expect(result).toMatchObject({ status: "blocked", reason: "progress-changed" });
    expect(source.fetchProtectedReviewSnapshot).not.toHaveBeenCalled();
  });
});
