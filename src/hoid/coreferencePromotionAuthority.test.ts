import { describe, expect, it } from "vitest";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";
import { getVerifiedChapterDocumentSha256 } from "./verifiedChapterDocuments";
import {
  auditHoidCoreferenceRegistry,
} from "./coreferenceResolver";
import {
  authorizeHoidCoreferencePromotion,
  buildHoidCoreferencePromotionManifest,
  buildHoidCoreferencePromotionPlan,
  buildProductionHoidCoreferencePromotionPlan,
  HOID_COREFERENCE_PROMOTION_MANIFEST_PATH,
  validateHoidCoreferencePromotionManifest,
} from "./coreferencePromotionAuthority";

const NOW = "2026-11-18T14:00:00.000Z";

function progress(revision = 8, chapter = 3) {
  const cursor = createHoidReadingCursor("tfe", chapter);
  if (cursor.status !== "ready") throw new Error("Cursor sintético no disponible");
  return {
    schemaVersion: 2,
    revision,
    positions: [{ bookId: "tfe", cursor: cursor.cursor }],
    updatedAt: NOW,
  };
}

function record() {
  const manifest = getHoidReadingManifest("tfe");
  if (manifest.status !== "ready") throw new Error("Manifiesto sintético no disponible");
  const unit = manifest.manifest.units.find(item => item.chapterNumber === 1);
  if (!unit?.locatorId) throw new Error("Localizador sintético no disponible");
  const documentSha256 = getVerifiedChapterDocumentSha256(
    "tfe",
    manifest.manifest.editionId,
    manifest.manifest.navigationSha256,
    1,
  );
  if (!documentSha256) throw new Error("Documento sintético no verificado");
  return {
    id: "synthetic.coref.alpha",
    entityId: "synthetic.entity-alpha",
    form: "ella" as const,
    evidence: [{
      id: "synthetic.coref-evidence-alpha",
      source: {
        bookId: "tfe",
        chapter: 1,
        locatorId: unit.locatorId,
        editionId: manifest.manifest.editionId,
        navigationSha256: manifest.manifest.navigationSha256,
        documentSha256,
      },
      unlock: { bookId: "tfe", chapter: 2 },
    }],
    review: {
      status: "approved" as const,
      origin: "original-editorial" as const,
      reviewerId: "Reviewer_ABC",
      reviewedAt: "2026-11-18T13:00:00.000Z",
    },
  };
}

function plan() {
  const result = buildHoidCoreferencePromotionPlan([record()], progress());
  if (result.status !== "ready") throw new Error("Plan sintético no disponible: " + result.status);
  return result.plan;
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 2,
    repositoryFullName: "Bhoa12/atlas-cosmere",
    pullRequestNumber: 29,
    expectedBaseRef: "feat/hoid-ia-core-run135",
    expectedBaseSha: "b".repeat(40),
    expectedHeadRef: "feat/hoid-ia-core-run136",
    expectedHeadSha: "a".repeat(40),
    promotionManifestPath: HOID_COREFERENCE_PROMOTION_MANIFEST_PATH,
    minimumApprovals: 1,
    requireCodeOwnerReview: false,
    requireDismissStaleReviews: true,
    requireEnforcedAdmins: true,
    ...overrides,
  };
}

function snapshot(fingerprint: string, reviewerId = "Reviewer_ABC", overrides: Record<string, unknown> = {}) {
  const base = {
    schemaVersion: 2,
    repositoryFullName: "Bhoa12/atlas-cosmere",
    pullRequestNumber: 29,
    state: "open",
    draft: false,
    baseRef: "feat/hoid-ia-core-run135",
    baseSha: "b".repeat(40),
    headRef: "feat/hoid-ia-core-run136",
    headSha: "a".repeat(40),
    authorId: "author-1",
    promotionManifestPath: HOID_COREFERENCE_PROMOTION_MANIFEST_PATH,
    promotionPlanFingerprint: fingerprint,
    verifiedAt: "2026-11-18T13:59:30.000Z",
    branchProtection: {
      status: "verified",
      requiredApprovingReviewCount: 1,
      requireCodeOwnerReview: false,
      dismissStaleReviews: true,
      enforceAdmins: true,
    },
    reviews: [{
      reviewId: "review-1",
      reviewerId,
      state: "APPROVED",
      commitSha: "a".repeat(40),
      submittedAt: "2026-11-18T13:59:00.000Z",
      dismissed: false,
      isCodeOwner: false,
    }],
  };
  return { ...base, ...overrides };
}

function ports(reviewSnapshot: unknown, snapshots: readonly unknown[] = [progress(), progress()]) {
  let index = 0;
  return {
    source: {
      fetchProtectedReviewSnapshot: async () => reviewSnapshot,
    },
    progress: {
      readAuthoritativeProgressSnapshot: async () => {
        const selected = snapshots[Math.min(index, snapshots.length - 1)];
        index += 1;
        return selected;
      },
    },
  };
}

describe("Hoid coreference promotion authority", () => {
  it("builds deterministic metadata-only registry and evidence fingerprints", () => {
    const first = buildHoidCoreferencePromotionPlan([record()], progress());
    const second = buildHoidCoreferencePromotionPlan([record()], progress());
    expect(first).toEqual(second);
    expect(first.status).toBe("ready");
    if (first.status === "ready") {
      expect(first.plan.recordIds).toEqual(["synthetic.coref.alpha"]);
      expect(first.plan.entityIds).toEqual(["synthetic.entity-alpha"]);
      expect(first.plan.reviewerIds).toEqual(["Reviewer_ABC"]);
      expect(first.plan.promotionAllowed).toBe(false);
      expect(first.plan.productionWritePerformed).toBe(false);
    }
  });

  it("does not prepare a review plan until every source-specific unlock threshold is completed", () => {
    const beforeUnlock = buildHoidCoreferencePromotionPlan([record()], progress(8, 2));
    expect(beforeUnlock).toEqual({
      status: "blocked",
      reason: "source-evidence-not-unlocked",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
    expect(buildHoidCoreferencePromotionPlan([record()], progress(8, 3)).status).toBe("ready");
  });

  it("keeps the production plan blocked while the registry is empty", () => {
    expect(buildProductionHoidCoreferencePromotionPlan(progress())).toEqual({
      status: "blocked",
      reason: "no-coreference-records",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  });

  it("rejects malformed or uninspected registry evidence", () => {
    const invalid = [{ ...record(), evidence: [{
      ...record().evidence[0],
      source: { ...record().evidence[0].source, documentSha256: "0".repeat(64) },
    }] }];
    expect(auditHoidCoreferenceRegistry(invalid)).toEqual({ status: "invalid" });
    expect(buildHoidCoreferencePromotionPlan(invalid, progress()).status).toBe("invalid");
  });

  it("builds and validates a manifest bound to the exact plan", () => {
    const currentPlan = plan();
    const built = buildHoidCoreferencePromotionManifest(currentPlan);
    expect(built.status).toBe("valid");
    if (built.status !== "valid") return;
    expect(validateHoidCoreferencePromotionManifest(built.manifest, currentPlan).status).toBe("valid");
    expect(validateHoidCoreferencePromotionManifest(
      { ...built.manifest, registryFingerprint: "f".repeat(64) },
      currentPlan,
    )).toEqual({ status: "invalid", reason: "manifest-mismatch" });
  });

  it("rejects a plan whose registry or progress fingerprint was changed", () => {
    const currentPlan = plan();
    expect(buildHoidCoreferencePromotionManifest({
      ...currentPlan,
      registryFingerprint: "f".repeat(64),
    })).toEqual({ status: "invalid", reason: "invalid-plan" });
    expect(buildHoidCoreferencePromotionManifest({
      ...currentPlan,
      progressRevision: currentPlan.progressRevision + 1,
    })).toEqual({ status: "invalid", reason: "invalid-plan" });
  });

  it("authorizes only a maintainer-controlled commit after the exact protected head is reviewed", async () => {
    const currentPlan = plan();
    const adapters = ports(snapshot(currentPlan.fingerprint));
    const result = await authorizeHoidCoreferencePromotion(
      currentPlan,
      [record()],
      request(),
      adapters.source,
      adapters.progress,
    );
    expect(result.status).toBe("ready-for-maintainer-commit");
    if (result.status === "ready-for-maintainer-commit") {
      expect(result.baseSha).toBe("b".repeat(40));
      expect(result.authenticatedReviewerIds).toEqual(["Reviewer_ABC"]);
      expect(result.promotionAllowed).toBe(false);
      expect(result.productionWritePerformed).toBe(false);
    }
  });

  it("requires every registry reviewer to be authenticated on the exact head", async () => {
    const currentPlan = plan();
    const adapters = ports(snapshot(currentPlan.fingerprint, "different-reviewer"));
    const result = await authorizeHoidCoreferencePromotion(
      currentPlan,
      [record()],
      request(),
      adapters.source,
      adapters.progress,
    );
    expect(result).toMatchObject({
      status: "blocked",
      reason: "reviewer-not-authenticated",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  });

  it("rejects draft, stale-head and insufficient-protection snapshots", async () => {
    const currentPlan = plan();
    const adapters = ports(snapshot(currentPlan.fingerprint, "Reviewer_ABC", { draft: true }));
    const result = await authorizeHoidCoreferencePromotion(
      currentPlan,
      [record()],
      request(),
      adapters.source,
      adapters.progress,
    );
    expect(result).toMatchObject({ status: "blocked", reason: "review-not-satisfied" });
  });

  it("invalidates authorization if reading progress changes while reviews are fetched", async () => {
    const currentPlan = plan();
    const adapters = ports(snapshot(currentPlan.fingerprint), [progress(), progress(9, 3)]);
    const result = await authorizeHoidCoreferencePromotion(
      currentPlan,
      [record()],
      request(),
      adapters.source,
      adapters.progress,
    );
    expect(result).toMatchObject({
      status: "blocked",
      reason: "progress-changed",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  });

  it("rejects an altered registry even when the caller reuses the old plan", async () => {
    const currentPlan = plan();
    const changed = [record(), {
      ...record(),
      id: "synthetic.coref.beta",
      entityId: "synthetic.entity-beta",
      evidence: [{
        ...record().evidence[0],
        id: "synthetic.coref-evidence-beta",
      }],
    }];
    const adapters = ports(snapshot(currentPlan.fingerprint));
    const result = await authorizeHoidCoreferencePromotion(
      currentPlan,
      changed,
      request(),
      adapters.source,
      adapters.progress,
    );
    expect(result).toMatchObject({ status: "blocked", reason: "registry-changed" });
  });
});
