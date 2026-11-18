import { describe, expect, it } from "vitest";
import { getHoidReadingManifest } from "./readingManifest";
import { sha256Hex } from "./sha256";
import {
  authorizeHoidTopicAssignmentActivation,
  buildHoidTopicAssignmentActivationReceipt,
  HOID_TOPIC_ASSIGNMENT_ACTIVATION_RECEIPT,
  HOID_TOPIC_ASSIGNMENT_ACTIVATION_RECEIPT_PATH,
  HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH,
  resolveHoidTopicAssignmentsForActivation,
  resolveProductionHoidTopicAssignments,
  validateHoidTopicAssignmentActivationReceipt,
} from "./topicAssignmentActivation";
import { fingerprintHoidTopicAssignmentRegistry } from "./topicAssignmentPromotionAuthority";

const CLAIM_TEXT = "Afirmación editorial sintética para probar la activación temática.";
const REVIEWED_AT = "2026-11-18T11:00:00.000Z";

function locator(bookId: string, chapter: number): string {
  const manifest = getHoidReadingManifest(bookId);
  if (manifest.status !== "ready") throw new Error("Manifiesto sintético no disponible");
  const unit = manifest.manifest.units.find(item => item.chapterNumber === chapter);
  if (!unit?.locatorId) throw new Error("Localizador sintético no disponible");
  return unit.locatorId;
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
      reviewedAt: REVIEWED_AT,
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

function registry() {
  const result = fingerprintHoidTopicAssignmentRegistry([assignment()], approvedClaims, approvedKnowledge);
  if (result.status !== "valid") throw new Error("Registro sintético no disponible");
  return result;
}

function authorization(overrides: Record<string, unknown> = {}) {
  const current = registry();
  return {
    status: "ready-for-maintainer-commit",
    repositoryFullName: "Bhoa12/atlas-cosmere",
    pullRequestNumber: 142,
    headSha: "a".repeat(40),
    promotionPlanFingerprint: "b".repeat(64),
    assignmentFingerprint: current.assignmentFingerprint,
    evidenceFingerprint: current.evidenceFingerprint,
    authenticatedAssignmentReviewerIds: current.assignmentReviewerIds,
    approvalReviewerIds: ["reviewer-1", "reviewer-2"],
    requiredApprovals: 1,
    protectedReviewVerified: true,
    promotionAllowed: false,
    productionWritePerformed: false,
    ...overrides,
  };
}

function mergedSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    repositoryFullName: "Bhoa12/atlas-cosmere",
    pullRequestNumber: 142,
    state: "closed",
    draft: false,
    merged: true,
    baseRef: "main",
    headRef: "feat/hoid-ia-core-run142",
    headSha: "a".repeat(40),
    mergeCommitSha: "c".repeat(40),
    promotionManifestPath: HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH,
    promotionPlanFingerprint: "b".repeat(64),
    mergedAt: "2026-11-18T12:00:00.000Z",
    ...overrides,
  };
}

function builtReceipt() {
  const result = buildHoidTopicAssignmentActivationReceipt(
    authorization(),
    mergedSnapshot(),
    [assignment()],
    approvedClaims,
    approvedKnowledge,
  );
  if (result.status !== "ready-for-maintainer-receipt") throw new Error("Recibo sintético no disponible");
  return result.receipt;
}

describe("Hoid topic assignment activation", () => {
  it("keeps the empty production registry inactive", () => {
    expect(HOID_TOPIC_ASSIGNMENT_ACTIVATION_RECEIPT).toBeNull();
    expect(resolveProductionHoidTopicAssignments()).toEqual({
      status: "inactive",
      reason: "no-topic-assignments",
    });
  });

  it("does not activate a valid assignment registry without a post-merge receipt", () => {
    expect(resolveHoidTopicAssignmentsForActivation(
      [assignment()],
      null,
      approvedClaims,
      approvedKnowledge,
    )).toEqual({ status: "inactive", reason: "activation-receipt-missing" });
  });

  it("builds a metadata-only receipt from the exact protected authorization and merged PR head", () => {
    const result = buildHoidTopicAssignmentActivationReceipt(
      authorization(),
      mergedSnapshot(),
      [assignment()],
      approvedClaims,
      approvedKnowledge,
    );
    expect(result.status).toBe("ready-for-maintainer-receipt");
    if (result.status !== "ready-for-maintainer-receipt") return;
    expect(result.receipt.assignmentIds).toEqual(["topic-assignment.alpha"]);
    expect(result.receipt.assignmentReviewerIds).toEqual(["reviewer-1"]);
    expect(result.receipt.approvalReviewerIds).toEqual(["reviewer-1", "reviewer-2"]);
    expect(result.receipt.mergeCommitSha).toBe("c".repeat(40));
    expect(result.productionWritePerformed).toBe(false);
    expect(HOID_TOPIC_ASSIGNMENT_ACTIVATION_RECEIPT_PATH).toBe("docs/hoid/topic-assignment-activation.receipt.json");
  });

  it("rejects a draft, unmerged PR, wrong base, wrong head, or wrong manifest", () => {
    const cases = [
      mergedSnapshot({ draft: true }),
      mergedSnapshot({ state: "open" }),
      mergedSnapshot({ merged: false }),
      mergedSnapshot({ baseRef: "feat/hoid-ia-core-run140" }),
      mergedSnapshot({ headSha: "d".repeat(40) }),
      mergedSnapshot({ promotionManifestPath: "src/hoid/topicTaxonomy.ts" }),
      mergedSnapshot({ promotionPlanFingerprint: "e".repeat(64) }),
    ];
    for (const snapshot of cases) {
      expect(buildHoidTopicAssignmentActivationReceipt(
        authorization(),
        snapshot,
        [assignment()],
        approvedClaims,
        approvedKnowledge,
      ).status).toBe("blocked");
    }
  });

  it("rejects an authorization whose assignment reviewer is not authenticated", () => {
    expect(buildHoidTopicAssignmentActivationReceipt(
      authorization({ approvalReviewerIds: ["reviewer-2"] }),
      mergedSnapshot(),
      [assignment()],
      approvedClaims,
      approvedKnowledge,
    )).toEqual({
      status: "blocked",
      reason: "invalid-authorization",
      productionWritePerformed: false,
    });
  });

  it("rejects a changed assignment or evidence registry after protected review", () => {
    const receipt = builtReceipt();
    expect(validateHoidTopicAssignmentActivationReceipt(
      receipt,
      [assignment({ worldLabel: "Otro mundo" })],
      approvedClaims,
      approvedKnowledge,
    )).toEqual({ status: "invalid", reason: "registry-mismatch" });

    const changedKnowledge = [{
      ...approvedKnowledge[0],
      evidenceSource: {
        bookId: "tfe",
        chapter: 2,
        locatorId: locator("tfe", 2),
      },
    }];
    expect(validateHoidTopicAssignmentActivationReceipt(
      receipt,
      [assignment()],
      approvedClaims,
      changedKnowledge,
    )).toEqual({ status: "invalid", reason: "registry-mismatch" });
  });

  it("rejects a modified receipt fingerprint and non-canonical reviewer arrays", () => {
    const receipt = builtReceipt();
    expect(validateHoidTopicAssignmentActivationReceipt(
      { ...receipt, mergeCommitSha: "d".repeat(40) },
      [assignment()],
      approvedClaims,
      approvedKnowledge,
    )).toEqual({ status: "invalid", reason: "receipt-fingerprint-mismatch" });

    expect(validateHoidTopicAssignmentActivationReceipt(
      { ...receipt, approvalReviewerIds: ["reviewer-2", "reviewer-1"] },
      [assignment()],
      approvedClaims,
      approvedKnowledge,
    )).toEqual({ status: "invalid", reason: "invalid-receipt" });
  });

  it("activates only the exact registry represented by a valid receipt", () => {
    const receipt = builtReceipt();
    const result = resolveHoidTopicAssignmentsForActivation(
      [assignment()],
      receipt,
      approvedClaims,
      approvedKnowledge,
    );
    expect(result.status).toBe("active");
    if (result.status !== "active") return;
    expect(result.assignments.map(item => item.id)).toEqual(["topic-assignment.alpha"]);
    expect(result.receipt.receiptFingerprint).toBe(receipt.receiptFingerprint);
  });

  it("uses a read-only merged-review port and never writes production", async () => {
    const result = await authorizeHoidTopicAssignmentActivation(
      authorization(),
      { fetchMergedPromotionSnapshot: async request => {
        expect(request.targetBranch).toBe("main");
        expect(request.expectedHeadSha).toBe("a".repeat(40));
        expect(request.promotionManifestPath).toBe(HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH);
        return mergedSnapshot();
      } },
      [assignment()],
      approvedClaims,
      approvedKnowledge,
    );
    expect(result.status).toBe("ready-for-maintainer-receipt");
    if (result.status === "ready-for-maintainer-receipt") {
      expect(result.productionWritePerformed).toBe(false);
    }
  });

  it("fails closed when the merge adapter is missing or unavailable", async () => {
    expect(await authorizeHoidTopicAssignmentActivation(
      authorization(),
      {},
      [assignment()],
      approvedClaims,
      approvedKnowledge,
    )).toEqual({
      status: "blocked",
      reason: "invalid-merge-port",
      productionWritePerformed: false,
    });

    expect(await authorizeHoidTopicAssignmentActivation(
      authorization(),
      { fetchMergedPromotionSnapshot: async () => { throw new Error("offline"); } },
      [assignment()],
      approvedClaims,
      approvedKnowledge,
    )).toEqual({
      status: "blocked",
      reason: "merge-source-unavailable",
      productionWritePerformed: false,
    });
  });
});
