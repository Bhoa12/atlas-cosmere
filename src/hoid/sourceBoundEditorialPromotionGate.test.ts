import { describe, expect, it, vi } from "vitest";
import { HOID_EDITORIAL_DRAFTS } from "./editorialDrafts";
import { buildHoidEditorialKnowledgeBundle } from "./editorialKnowledgeBundle";
import { buildHoidEditorialReviewBundle } from "./editorialReviewBundle";
import {
  buildHoidEditorialReviewPackets,
  fingerprintHoidEditorialReviewDecision,
  validateHoidEditorialReviewReceipt,
} from "./editorialReviewPackets";
import { buildHoidEditorialBundlePromotionPlan } from "./editorialBundlePromotionAuthority";
import { createHoidReadingCursor } from "./readingManifest";
import type { HoidEditorialSummaryPromotionPreflightPort } from "./editorialSummaryPromotionPreflight";
import type {
  HoidTrustedHostPromotionInput,
  HoidTrustedHostPromotionResult,
} from "./trustedHostPromotionAuthority";
import {
  createHoidSourceBoundEditorialPromotionGatePort,
  type HoidTrustedHostPromotionAuthorityPort,
} from "./sourceBoundEditorialPromotionGate";

const REPOSITORY = "Bhoa12/atlas-cosmere";
const REVIEWED_AT = "2026-11-27T20:00:00.000Z";
const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const SHA_C = "c".repeat(64);
const SHA_D = "d".repeat(64);
const SUMMARY_ID = "twok.chapter-001.cenn-battle";

const summaryDraft = (() => {
  const value = HOID_EDITORIAL_DRAFTS.find(item => item.id === SUMMARY_ID);
  if (!value) throw new Error("Borrador de resumen sintético no disponible");
  return value;
})();

const sourceInput = Object.freeze({
  summaries: Object.freeze([summaryDraft]),
  claims: Object.freeze([]),
  entities: Object.freeze([]),
  relationships: Object.freeze([]),
});
const knowledge = buildHoidEditorialKnowledgeBundle(sourceInput);
if (knowledge.status !== "ready-for-review") throw new Error("Knowledge bundle de prueba no disponible");
const review = buildHoidEditorialReviewBundle(knowledge.manifest, sourceInput);
if (review.status !== "ready-for-review") throw new Error("Review bundle de prueba no disponible");
const packetBuild = buildHoidEditorialReviewPackets([summaryDraft]);
if (packetBuild.status !== "ready" || packetBuild.packets.length !== 1) {
  throw new Error("Paquete de resumen de prueba no disponible");
}
const packet = packetBuild.packets[0];

const approvedChecklist = Object.freeze({
  factualAccuracy: true,
  completeness: true,
  originality: true,
  spoilerCeiling: true,
  provenance: true,
});
const noteCodes = Object.freeze(["no-issues"] as const);
const bundleReceipt = Object.freeze({
  schemaVersion: 1,
  packetId: packet.packetId,
  draftId: packet.draftId,
  summarySha256: packet.summarySha256,
  sourceDocumentSha256: packet.sourceDocumentSha256,
  decision: "approved",
  reviewerId: "reviewer-a",
  reviewedAt: "2026-11-27T20:01:00.000Z",
  checklist: approvedChecklist,
  noteCodes,
});
const receipts = Object.freeze({
  schemaVersion: 1,
  reviewBundleFingerprint: review.manifest.fingerprint,
  summaries: Object.freeze([bundleReceipt]),
  claims: Object.freeze([]),
  entities: Object.freeze([]),
  relationships: Object.freeze([]),
});

const progressCursor = createHoidReadingCursor("twok", 2);
if (progressCursor.status !== "ready") throw new Error("Progreso de prueba no disponible");
const progressSnapshot = Object.freeze({
  schemaVersion: 2,
  revision: 17,
  positions: Object.freeze([
    Object.freeze({ bookId: "twok", cursor: progressCursor.cursor, order: 1 }),
  ]),
  updatedAt: REVIEWED_AT,
});
const planBuild = buildHoidEditorialBundlePromotionPlan(
  review.manifest,
  knowledge.manifest,
  sourceInput,
  receipts,
  progressSnapshot,
);
if (planBuild.status !== "ready-for-protected-review") {
  throw new Error("Plan de promoción sintético no disponible");
}
const plan = planBuild.plan;

const localReceiptValidation = validateHoidEditorialReviewReceipt(packet, {
  ...bundleReceipt,
  reviewerId: "device-local-unverified",
  reviewedAt: REVIEWED_AT,
});
if (localReceiptValidation.status !== "valid") {
  throw new Error("Recibo local sintético no disponible");
}
const localDecisionFingerprint = fingerprintHoidEditorialReviewDecision(
  localReceiptValidation.receipt,
);

const request = Object.freeze({
  schemaVersion: 2,
  repositoryFullName: REPOSITORY,
  pullRequestNumber: 267,
  expectedBaseRef: "feat/hoid-ia-core-run373",
  expectedBaseSha: "459e0e8c341444041dd76fb47ad8a22af2ffd76a",
  expectedHeadRef: "feat/hoid-ia-core-run374",
  expectedHeadSha: "e".repeat(40),
  promotionManifestPath: "docs/hoid/EDITORIAL_PROMOTION_MANIFEST.json",
  minimumApprovals: 2,
  requireCodeOwnerReview: true,
  requireDismissStaleReviews: true,
  requireEnforcedAdmins: true,
});
const promotionInput = Object.freeze({
  plan,
  context: Object.freeze({
    reviewManifest: review.manifest,
    knowledgeManifest: knowledge.manifest,
    source: sourceInput,
    receipts,
  }),
  request,
  progressSnapshot,
}) as unknown as HoidTrustedHostPromotionInput;

function preflightResult(
  receiptFingerprint = SHA_D,
  decisionFingerprint = localDecisionFingerprint,
  progressRevision = plan.progressRevision,
  progressFingerprint = plan.progressFingerprint,
) {
  return Object.freeze({
    status: "ready-for-authenticated-review" as const,
    packetId: packet.packetId,
    draftId: packet.draftId,
    workId: summaryDraft.evidenceSource.bookId,
    chapterNumber: summaryDraft.evidenceSource.chapter,
    editionId: summaryDraft.sourceIntegrity.editionId,
    progressRevision,
    progressFingerprint,
    receiptFingerprint,
    reviewDecisionFingerprint: decisionFingerprint,
    sourceDocumentVerified: true as const,
    reviewerIdentity: "unverified-local" as const,
    promotionAllowed: false as const,
    productionWritePerformed: false as const,
    answerAuthorizationEffect: "none" as const,
    spoilerUnlockEffect: "none" as const,
  });
}

function readyTrustedHostResult(
  overrides: Readonly<{ promotionAllowed?: boolean; productionWritePerformed?: boolean }> = {},
): HoidTrustedHostPromotionResult {
  const signedAuthorization = Object.freeze({
    status: "ready-for-maintainer-commit",
    repositoryFullName: REPOSITORY,
    pullRequestNumber: request.pullRequestNumber,
    baseSha: request.expectedBaseSha,
    headSha: request.expectedHeadSha,
    promotionPlanFingerprint: plan.fingerprint,
    reviewBundleFingerprint: plan.reviewBundleFingerprint,
    receiptsFingerprint: plan.receiptsFingerprint,
    authenticatedReceiptReviewerIds: Object.freeze(["reviewer-a", "reviewer-b"]),
    approvalReviewerIds: Object.freeze(["reviewer-a", "reviewer-b"]),
    requiredApprovals: 2,
    protectedReviewVerified: true,
    editorialReviewComplete: true,
    verifiedReceiptCount: plan.packetCount,
    trustRegistryRevision: 1,
    signatureBatchFingerprint: SHA_A,
    promotionAllowed: overrides.promotionAllowed ?? false,
    productionWritePerformed: overrides.productionWritePerformed ?? false,
  });
  const revisionBound = Object.freeze({
    status: "ready-for-maintainer-commit",
    authorization: signedAuthorization,
    trustDomainId: "atlas-cosmere-production",
    trustRegistryRevision: 1,
    minimumRegistryRevision: 1,
    minimumRevisionPersisted: true,
    promotionAllowed: false,
    productionWritePerformed: false,
  });
  const quorum = Object.freeze({
    status: "verified",
    reviewBundleFingerprint: plan.reviewBundleFingerprint,
    promotionPlanFingerprint: plan.fingerprint,
    progressRevision: plan.progressRevision,
    verifiedReviewerCount: 2,
    reviewerIds: Object.freeze(["reviewer-a", "reviewer-b"]),
    promotionAllowed: false,
    productionWritePerformed: false,
  });
  return Object.freeze({
    status: "ready-for-maintainer-commit",
    authorization: revisionBound,
    bundleReviewQuorum: quorum,
    bootstrapFingerprint: SHA_B,
    configuredMinimumRegistryRevision: 1,
    persistedMinimumRegistryRevision: 1,
    promotionAllowed: false,
    productionWritePerformed: false,
  }) as unknown as HoidTrustedHostPromotionResult;
}

function fixture(options: Readonly<{
  audit?: (call: number) => unknown | Promise<unknown>;
  authorityResult?: HoidTrustedHostPromotionResult;
}> = {}) {
  let auditCall = 0;
  const audit = vi.fn(async (_input: unknown) => {
    auditCall += 1;
    return options.audit ? await options.audit(auditCall) : preflightResult();
  });
  const authorize = vi.fn(async () =>
    options.authorityResult ?? readyTrustedHostResult()
  );
  const sourcePreflightPort = Object.freeze({ audit }) as unknown as HoidEditorialSummaryPromotionPreflightPort;
  const trustedHostAuthority = Object.freeze({ authorize }) as unknown as HoidTrustedHostPromotionAuthorityPort;
  const port = createHoidSourceBoundEditorialPromotionGatePort({
    sourcePreflightPort,
    trustedHostAuthority,
  });
  return { port, audit, authorize };
}

describe("Hoid source-bound signed editorial promotion gate", () => {
  it("rechecks every summary source before and after trusted-host authorization", async () => {
    const value = fixture();
    const result = await value.port.authorize(promotionInput);
    expect(result).toMatchObject({
      status: "ready-for-maintainer-commit",
      summaryPacketCount: 1,
      verifiedSourceCount: 1,
      progressRevision: plan.progressRevision,
      verifiedReceiptCount: plan.packetCount,
      verifiedReviewerCount: 2,
      trustRegistryRevision: 1,
      minimumRegistryRevision: 1,
      sourceContentIncluded: false,
      providerEgress: "none",
      promotionAllowed: false,
      productionWritePerformed: false,
      answerAuthorizationEffect: "none",
      spoilerUnlockEffect: "none",
    });
    expect(value.audit).toHaveBeenCalledTimes(2);
    expect(value.audit).toHaveBeenNthCalledWith(1, { packetId: packet.packetId });
    expect(value.audit).toHaveBeenNthCalledWith(2, { packetId: packet.packetId });
    expect(value.authorize).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain(summaryDraft.summary);
    expect(JSON.stringify(result)).not.toContain(packet.source.locatorId);
    expect(JSON.stringify(result)).not.toContain(packet.sourceDocumentSha256);
  });

  it("binds the local decision to the authenticated receipt while allowing reviewer identity and time to differ", async () => {
    const value = fixture();
    const result = await value.port.authorize(promotionInput);
    expect(bundleReceipt.reviewerId).toBe("reviewer-a");
    expect(localReceiptValidation.receipt.reviewerId).toBe("device-local-unverified");
    expect(bundleReceipt.reviewedAt).not.toBe(localReceiptValidation.receipt.reviewedAt);
    expect(result.status).toBe("ready-for-maintainer-commit");
    expect(value.authorize).toHaveBeenCalledTimes(1);
  });

  it("blocks before trusted-host authorization when the local review decision differs", async () => {
    const value = fixture({ audit: async () => preflightResult(SHA_D, SHA_C) });
    expect(await value.port.authorize(promotionInput)).toMatchObject({
      status: "blocked",
      reason: "source-preflight-invalid",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
    expect(value.authorize).not.toHaveBeenCalled();
  });

  it("blocks when a source preflight reports that the chapter is unavailable", async () => {
    const value = fixture({
      audit: async () => Object.freeze({
        status: "blocked",
        reason: "source-unavailable",
        promotionAllowed: false,
        productionWritePerformed: false,
      }),
    });
    expect(await value.port.authorize(promotionInput)).toMatchObject({
      status: "blocked",
      reason: "source-preflight-blocked",
    });
    expect(value.authorize).not.toHaveBeenCalled();
  });

  it("rejects a preflight bound to a different progress revision", async () => {
    const value = fixture({
      audit: async () => preflightResult(SHA_D, localDecisionFingerprint, plan.progressRevision + 1),
    });
    expect(await value.port.authorize(promotionInput)).toMatchObject({
      status: "blocked",
      reason: "source-preflight-invalid",
    });
    expect(value.authorize).not.toHaveBeenCalled();
  });

  it("rejects a different progress fingerprint even when the revision number matches", async () => {
    const value = fixture({
      audit: async () => preflightResult(
        SHA_D,
        localDecisionFingerprint,
        plan.progressRevision,
        SHA_C,
      ),
    });
    expect(await value.port.authorize(promotionInput)).toMatchObject({
      status: "blocked",
      reason: "source-preflight-invalid",
    });
    expect(value.authorize).not.toHaveBeenCalled();
  });

  it("rebuilds the signed plan after authority to reject mutated bundle receipts", async () => {
    const mutableReceipt = { ...bundleReceipt };
    const mutableReceipts = { ...receipts, summaries: [mutableReceipt] };
    const mutableInput = {
      plan,
      context: {
        reviewManifest: review.manifest,
        knowledgeManifest: knowledge.manifest,
        source: sourceInput,
        receipts: mutableReceipts,
      },
      request,
      progressSnapshot,
    } as unknown as HoidTrustedHostPromotionInput;
    const audit = vi.fn(async () => preflightResult());
    const authorize = vi.fn(async () => {
      mutableReceipt.reviewerId = "reviewer-b";
      return readyTrustedHostResult();
    });
    const port = createHoidSourceBoundEditorialPromotionGatePort({
      sourcePreflightPort: { audit } as unknown as HoidEditorialSummaryPromotionPreflightPort,
      trustedHostAuthority: { authorize } as unknown as HoidTrustedHostPromotionAuthorityPort,
    });
    expect(await port.authorize(mutableInput)).toMatchObject({
      status: "blocked",
      reason: "source-preflight-changed",
    });
    expect(audit).toHaveBeenCalledTimes(1);
    expect(authorize).toHaveBeenCalledTimes(1);
  });

  it("rejects source or local-receipt changes between the two preflight passes", async () => {
    const value = fixture({
      audit: async call => preflightResult(call === 1 ? SHA_D : SHA_C),
    });
    expect(await value.port.authorize(promotionInput)).toMatchObject({
      status: "blocked",
      reason: "source-preflight-changed",
    });
    expect(value.audit).toHaveBeenCalledTimes(2);
  });

  it("does not run a second source pass when trusted-host authorization is blocked", async () => {
    const value = fixture({
      authorityResult: Object.freeze({
        status: "blocked",
        reason: "trusted-host-bootstrap-blocked",
        promotionAllowed: false,
        productionWritePerformed: false,
      }) as unknown as HoidTrustedHostPromotionResult,
    });
    expect(await value.port.authorize(promotionInput)).toMatchObject({
      status: "blocked",
      reason: "trusted-host-authorization-blocked",
    });
    expect(value.audit).toHaveBeenCalledTimes(1);
  });

  it("rejects a trusted-host result that claims a production write", async () => {
    const value = fixture({
      authorityResult: readyTrustedHostResult({ productionWritePerformed: true }),
    });
    expect(await value.port.authorize(promotionInput)).toMatchObject({
      status: "blocked",
      reason: "trusted-host-result-invalid",
    });
  });

  it("rejects a preflight result that attempts to include chapter content", async () => {
    const value = fixture({
      audit: async () => Object.freeze({
        ...preflightResult(),
        xhtml: "<html>private chapter text</html>",
      }),
    });
    expect(await value.port.authorize(promotionInput)).toMatchObject({
      status: "blocked",
      reason: "source-preflight-invalid",
    });
    expect(value.authorize).not.toHaveBeenCalled();
  });

  it("rejects an accessor-backed preflight result without invoking the getter", async () => {
    let invoked = false;
    const malicious = Object.defineProperty({}, "status", {
      enumerable: true,
      get() {
        invoked = true;
        return "ready-for-authenticated-review";
      },
    });
    const value = fixture({ audit: async () => malicious });
    expect(await value.port.authorize(promotionInput)).toMatchObject({
      status: "blocked",
      reason: "source-preflight-invalid",
    });
    expect(invoked).toBe(false);
    expect(value.authorize).not.toHaveBeenCalled();
  });

  it("rejects an invalid plan before inspecting local sources", async () => {
    const value = fixture();
    const invalidInput = Object.freeze({
      ...promotionInput,
      plan: Object.freeze({ ...plan, fingerprint: SHA_C }),
    }) as unknown as HoidTrustedHostPromotionInput;
    expect(await value.port.authorize(invalidInput)).toMatchObject({
      status: "blocked",
      reason: "invalid-plan",
    });
    expect(value.audit).not.toHaveBeenCalled();
    expect(value.authorize).not.toHaveBeenCalled();
  });

  it("rejects accessor-backed promotion inputs without invoking getters", async () => {
    const value = fixture();
    let invoked = false;
    const invalidInput = Object.defineProperty({}, "plan", {
      enumerable: true,
      get() {
        invoked = true;
        return plan;
      },
    }) as unknown as HoidTrustedHostPromotionInput;
    expect(await value.port.authorize(invalidInput)).toMatchObject({
      status: "blocked",
      reason: "invalid-input",
    });
    expect(invoked).toBe(false);
    expect(value.audit).not.toHaveBeenCalled();
  });
});
