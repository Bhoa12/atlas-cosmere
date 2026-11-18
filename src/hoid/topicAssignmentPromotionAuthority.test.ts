import { describe, expect, it } from "vitest";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";
import { sha256Hex } from "./sha256";
import {
  authorizeHoidTopicAssignmentPromotion,
  buildHoidTopicAssignmentPromotionManifest,
  buildHoidTopicAssignmentPromotionPlan,
  buildProductionHoidTopicAssignmentPromotionPlan,
  HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH,
  validateHoidTopicAssignmentPromotionManifest,
} from "./topicAssignmentPromotionAuthority";

const UPDATED_AT = "2026-11-18T12:00:00.000Z";
const CLAIM_TEXT = "Afirmación editorial sintética para validar la autoridad de asignaciones temáticas.";

function cursor(bookId: string, chapter: number) {
  const result = createHoidReadingCursor(bookId, chapter);
  if (result.status !== "ready") throw new Error("Cursor sintético no disponible");
  return result.cursor;
}

function locator(bookId: string, chapter: number): string {
  const result = getHoidReadingManifest(bookId);
  if (result.status !== "ready") throw new Error("Manifiesto sintético no disponible");
  const unit = result.manifest.units.find(item => item.chapterNumber === chapter);
  if (!unit?.locatorId) throw new Error("Localizador sintético no disponible");
  return unit.locatorId;
}

function progress(revision = 8) {
  return {
    schemaVersion: 2,
    revision,
    positions: [{ bookId: "tfe", cursor: cursor("tfe", 3) }],
    updatedAt: UPDATED_AT,
  };
}

function assignment(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    id: "topic-assignment.alpha",
    subjectKind: "work",
    subjectId: "tfe",
    worldId: "world-alpha",
    worldLabel: "Mundo Alfa",
    topicId: "investiture-system",
    dimensionId: "mechanism",
    claimId: "claim.alpha",
    claimTextSha256: sha256Hex(CLAIM_TEXT),
    evidenceIds: ["evidence.alpha"],
    review: {
      status: "approved",
      reviewerId: "reviewer-1",
      reviewedAt: "2026-11-18T11:00:00.000Z",
    },
    ...overrides,
  };
}

const approvedClaims = [{
  id: "claim.alpha",
  text: CLAIM_TEXT,
  evidenceIds: ["evidence.alpha"],
}];

const approvedKnowledge = [{
  id: "evidence.alpha",
  kind: "concept",
  provenance: "verified",
  summary: "Resumen original sintético de prueba.",
  evidenceSource: {
    bookId: "tfe",
    chapter: 1,
    locatorId: locator("tfe", 1),
  },
  evidenceUnlock: { bookId: "tfe", chapter: 2 },
  firstSafeAppearance: { bookId: "tfe", chapter: 1 },
}];

function plan() {
  const result = buildHoidTopicAssignmentPromotionPlan(
    [assignment()],
    progress(),
    approvedClaims,
    approvedKnowledge,
  );
  if (result.status !== "ready") throw new Error("Plan sintético no disponible: " + result.status);
  return result.plan;
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    repositoryFullName: "Bhoa12/atlas-cosmere",
    pullRequestNumber: 26,
    expectedBaseRef: "feat/hoid-ia-core-run132",
    expectedHeadRef: "feat/hoid-ia-core-run133",
    expectedHeadSha: "a".repeat(40),
    promotionManifestPath: HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH,
    minimumApprovals: 1,
    requireCodeOwnerReview: false,
    requireDismissStaleReviews: true,
    requireEnforcedAdmins: true,
    ...overrides,
  };
}

function snapshot(planFingerprint: string, overrides: Record<string, unknown> = {}) {
  const base = {
    schemaVersion: 1,
    repositoryFullName: "Bhoa12/atlas-cosmere",
    pullRequestNumber: 26,
    state: "open",
    draft: false,
    baseRef: "feat/hoid-ia-core-run132",
    headRef: "feat/hoid-ia-core-run133",
    headSha: "a".repeat(40),
    authorId: "author-1",
    promotionManifestPath: HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH,
    promotionPlanFingerprint: planFingerprint,
    verifiedAt: "2026-11-18T11:59:30.000Z",
    branchProtection: {
      status: "verified",
      requiredApprovingReviewCount: 1,
      requireCodeOwnerReview: false,
      dismissStaleReviews: true,
      enforceAdmins: true,
    },
    reviews: [{
      reviewId: "review-1",
      reviewerId: "reviewer-1",
      state: "APPROVED",
      commitSha: "a".repeat(40),
      submittedAt: "2026-11-18T11:59:00.000Z",
      dismissed: false,
      isCodeOwner: false,
    }],
  };
  return { ...base, ...overrides };
}

function ports(
  reviewSnapshot: unknown,
  snapshots: readonly unknown[] = [progress(), progress()],
) {
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

describe("Hoid topic assignment promotion authority", () => {
  it("builds a deterministic metadata-only plan with exact assignment and evidence fingerprints", () => {
    const first = plan();
    const second = plan();
    expect(first).toEqual(second);
    expect(first.assignmentIds).toEqual(["topic-assignment.alpha"]);
    expect(first.assignmentReviewerIds).toEqual(["reviewer-1"]);
    expect(first.assignmentCount).toBe(1);
    expect(first.promotionAllowed).toBe(false);
    expect(first.productionWritePerformed).toBe(false);
  });

  it("preserves the exact case of source-control reviewer identities", () => {
    const result = buildHoidTopicAssignmentPromotionPlan(
      [assignment({
        review: {
          status: "approved",
          reviewerId: "Reviewer_ABC",
          reviewedAt: "2026-11-18T11:00:00.000Z",
        },
      })],
      progress(),
      approvedClaims,
      approvedKnowledge,
    );
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.plan.assignmentReviewerIds).toEqual(["Reviewer_ABC"]);
    }
  });

  it("keeps the production authority blocked while the reviewed topic registry is empty", () => {
    expect(buildProductionHoidTopicAssignmentPromotionPlan(progress())).toEqual({
      status: "blocked",
      reason: "no-topic-assignments",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  });

  it("builds and validates a manifest bound to the exact plan fingerprint", () => {
    const currentPlan = plan();
    const built = buildHoidTopicAssignmentPromotionManifest(currentPlan);
    expect(built.status).toBe("valid");
    if (built.status !== "valid") return;
    expect(validateHoidTopicAssignmentPromotionManifest(built.manifest, currentPlan).status).toBe("valid");
    expect(validateHoidTopicAssignmentPromotionManifest(
      { ...built.manifest, assignmentFingerprint: "f".repeat(64) },
      currentPlan,
    )).toEqual({ status: "invalid", reason: "manifest-mismatch" });
  });

  it("rejects manifest arrays with accessors without invoking them", () => {
    const currentPlan = plan();
    const built = buildHoidTopicAssignmentPromotionManifest(currentPlan);
    if (built.status !== "valid") throw new Error("Manifiesto sintético no disponible");
    let invoked = false;
    const accessorIds: string[] = [];
    Object.defineProperty(accessorIds, "0", {
      enumerable: true,
      get() {
        invoked = true;
        return "topic-assignment.alpha";
      },
    });
    accessorIds.length = 1;
    const result = validateHoidTopicAssignmentPromotionManifest({
      ...built.manifest,
      assignmentIds: accessorIds,
    }, currentPlan);
    expect(result.status).toBe("invalid");
    expect(invoked).toBe(false);
  });

  it("rejects a plan whose assignment or progress fingerprint was changed", () => {
    const currentPlan = plan();
    expect(buildHoidTopicAssignmentPromotionManifest({
      ...currentPlan,
      assignmentFingerprint: "f".repeat(64),
    })).toEqual({ status: "invalid", reason: "invalid-plan" });
    expect(buildHoidTopicAssignmentPromotionManifest({
      ...currentPlan,
      progressRevision: currentPlan.progressRevision + 1,
    })).toEqual({ status: "invalid", reason: "invalid-plan" });
  });

  it("authorizes only a maintainer-controlled commit after all assignment reviewers approve the exact protected head", async () => {
    const currentPlan = plan();
    const adapters = ports(snapshot(currentPlan.fingerprint));
    const result = await authorizeHoidTopicAssignmentPromotion(
      currentPlan,
      [assignment()],
      request(),
      adapters.source,
      adapters.progress,
      approvedClaims,
      approvedKnowledge,
    );
    expect(result.status).toBe("ready-for-maintainer-commit");
    if (result.status !== "ready-for-maintainer-commit") return;
    expect(result.authenticatedAssignmentReviewerIds).toEqual(["reviewer-1"]);
    expect(result.approvalReviewerIds).toEqual(["reviewer-1"]);
    expect(result.promotionAllowed).toBe(false);
    expect(result.productionWritePerformed).toBe(false);
  });

  it("blocks when an assignment reviewer is not an authenticated PR approver", async () => {
    const currentPlan = plan();
    const adapters = ports(snapshot(currentPlan.fingerprint, {
      reviews: [{
        reviewId: "review-2",
        reviewerId: "reviewer-2",
        state: "APPROVED",
        commitSha: "a".repeat(40),
        submittedAt: "2026-11-18T11:59:00.000Z",
        dismissed: false,
        isCodeOwner: false,
      }],
    }));
    const result = await authorizeHoidTopicAssignmentPromotion(
      currentPlan, [assignment()], request(), adapters.source, adapters.progress, approvedClaims, approvedKnowledge,
    );
    expect(result).toEqual({
      status: "blocked",
      reason: "assignment-reviewer-not-authenticated",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  });

  it("does not count the PR author as the reviewer who approved an assignment", async () => {
    const currentPlan = plan();
    const adapters = ports(snapshot(currentPlan.fingerprint, { authorId: "reviewer-1" }));
    const result = await authorizeHoidTopicAssignmentPromotion(
      currentPlan, [assignment()], request(), adapters.source, adapters.progress, approvedClaims, approvedKnowledge,
    );
    expect(result.status).toBe("blocked");
    if (result.status === "blocked") expect(result.reason).toBe("review-not-satisfied");
  });

  it("rejects approvals attached to an older commit", async () => {
    const currentPlan = plan();
    const adapters = ports(snapshot(currentPlan.fingerprint, {
      reviews: [{
        reviewId: "review-1",
        reviewerId: "reviewer-1",
        state: "APPROVED",
        commitSha: "b".repeat(40),
        submittedAt: "2026-11-18T11:59:00.000Z",
        dismissed: false,
        isCodeOwner: false,
      }],
    }));
    const result = await authorizeHoidTopicAssignmentPromotion(
      currentPlan, [assignment()], request(), adapters.source, adapters.progress, approvedClaims, approvedKnowledge,
    );
    expect(result.status).toBe("blocked");
    if (result.status === "blocked") expect(result.verificationReason).toBe("approval-quorum-not-met");
  });

  it("rejects draft pull requests and a non-canonical promotion manifest path", async () => {
    const currentPlan = plan();
    const draftAdapters = ports(snapshot(currentPlan.fingerprint, { draft: true }));
    const draftResult = await authorizeHoidTopicAssignmentPromotion(
      currentPlan, [assignment()], request(), draftAdapters.source, draftAdapters.progress, approvedClaims, approvedKnowledge,
    );
    expect(draftResult.status).toBe("blocked");
    const pathAdapters = ports(snapshot(currentPlan.fingerprint));
    const pathResult = await authorizeHoidTopicAssignmentPromotion(
      currentPlan,
      [assignment()],
      request({ promotionManifestPath: "src/hoid/topicTaxonomy.ts" }),
      pathAdapters.source,
      pathAdapters.progress,
      approvedClaims,
      approvedKnowledge,
    );
    expect(pathResult).toEqual({
      status: "blocked",
      reason: "invalid-request",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  });

  it("rebuilds the assignment fingerprint before source-control review", async () => {
    const currentPlan = plan();
    const changedAssignment = assignment({ worldLabel: "Etiqueta cambiada" });
    const adapters = ports(snapshot(currentPlan.fingerprint));
    const result = await authorizeHoidTopicAssignmentPromotion(
      currentPlan, [changedAssignment], request(), adapters.source, adapters.progress, approvedClaims, approvedKnowledge,
    );
    expect(result).toEqual({
      status: "blocked",
      reason: "assignments-changed",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  });

  it("blocks if the authoritative reader progress changes during protected review", async () => {
    const currentPlan = plan();
    const adapters = ports(snapshot(currentPlan.fingerprint), [progress(8), progress(9)]);
    const result = await authorizeHoidTopicAssignmentPromotion(
      currentPlan, [assignment()], request(), adapters.source, adapters.progress, approvedClaims, approvedKnowledge,
    );
    expect(result).toEqual({
      status: "blocked",
      reason: "progress-changed",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  });

  it("fails closed when the source-control or authoritative progress port is missing", async () => {
    const currentPlan = plan();
    expect(await authorizeHoidTopicAssignmentPromotion(
      currentPlan, [assignment()], request(), null, ports(snapshot(currentPlan.fingerprint)).progress, approvedClaims, approvedKnowledge,
    )).toMatchObject({ status: "blocked", reason: "invalid-source-control-port" });
    expect(await authorizeHoidTopicAssignmentPromotion(
      currentPlan, [assignment()], request(), ports(snapshot(currentPlan.fingerprint)).source, null, approvedClaims, approvedKnowledge,
    )).toMatchObject({ status: "blocked", reason: "invalid-progress-port" });
  });

  it("never authorizes a production write even when the review is complete", async () => {
    const currentPlan = plan();
    const adapters = ports(snapshot(currentPlan.fingerprint));
    const result = await authorizeHoidTopicAssignmentPromotion(
      currentPlan, [assignment()], request(), adapters.source, adapters.progress, approvedClaims, approvedKnowledge,
    );
    expect(result.promotionAllowed).toBe(false);
    expect(result.productionWritePerformed).toBe(false);
  });
});
