import { describe, expect, it } from "vitest";
import { HOID_EDITORIAL_DRAFTS } from "./editorialDrafts";
import { HOID_EDITORIAL_CLAIM_DRAFTS } from "./editorialClaimDrafts";
import { HOID_EDITORIAL_ENTITY_DRAFTS } from "./editorialEntityDrafts";
import { HOID_EDITORIAL_RELATIONSHIP_DRAFTS } from "./editorialRelationshipDrafts";
import { buildHoidEditorialKnowledgeBundle } from "./editorialKnowledgeBundle";
import { buildHoidEditorialReviewBundle } from "./editorialReviewBundle";
import { buildHoidEditorialBundlePromotionPlan } from "./editorialBundlePromotionAuthority";
import { createHoidReadingCursor } from "./readingManifest";
import {
  buildHoidEditorialBundleReviewSigningMessage,
  verifyHoidEditorialKnowledgeBundleReviewQuorum,
  type HoidEditorialBundleReviewAttestation,
  type HoidEditorialBundleReviewContext,
} from "./editorialReviewBundleQuorum";
import {
  buildHoidReviewerTrustRegistrySigningMessage,
  type HoidReviewerTrustKey,
  type HoidReviewerTrustRegistry,
  type HoidReviewerTrustRegistryUnsigned,
} from "./editorialReviewSignatures";
import { sha256Hex } from "./sha256";

const NOW = "2026-11-25T20:00:00.000Z";
const REVIEWED_AT = "2026-11-25T18:00:00.000Z";
const REPOSITORY = "Bhoa12/atlas-cosmere";
const rootKey = Object.freeze({
  keyId: "hoid-review-root-2026",
  publicKeyHex: "11".repeat(32),
});

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
if (knowledgeResult.status !== "ready-for-review") {
  throw new Error("Resolved editorial knowledge fixture unavailable");
}
const knowledgeManifest = knowledgeResult.manifest;

const reviewResult = buildHoidEditorialReviewBundle(knowledgeManifest, sourceInput);
if (reviewResult.status !== "ready-for-review") {
  throw new Error("Resolved editorial review fixture unavailable");
}
const reviewManifest = reviewResult.manifest;
const packets = reviewResult.packets;

const reviewerA: HoidReviewerTrustKey = Object.freeze({
  keyId: "reviewer-key-a",
  reviewerId: "reviewer-a",
  algorithm: "Ed25519",
  publicKeyHex: "22".repeat(32),
  status: "active",
  validFrom: "2026-01-01T00:00:00.000Z",
  validUntil: "2027-01-01T00:00:00.000Z",
  revokedAt: null,
  allowedRepositoryFullNames: Object.freeze([REPOSITORY]),
});
const reviewerB: HoidReviewerTrustKey = Object.freeze({
  keyId: "reviewer-key-b",
  reviewerId: "reviewer-b",
  algorithm: "Ed25519",
  publicKeyHex: "33".repeat(32),
  status: "active",
  validFrom: "2026-01-01T00:00:00.000Z",
  validUntil: "2027-01-01T00:00:00.000Z",
  revokedAt: null,
  allowedRepositoryFullNames: Object.freeze([REPOSITORY]),
});

function progressSnapshot(chapter = 5, revision = 17) {
  const cursor = createHoidReadingCursor("twok", chapter);
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

const progress = progressSnapshot();

function approvedReceipts() {
  return Object.freeze({
    schemaVersion: 1,
    reviewBundleFingerprint: reviewManifest.fingerprint,
    summaries: Object.freeze(packets.summaries.map((packet, index) => ({
      schemaVersion: 1,
      packetId: packet.packetId,
      draftId: packet.draftId,
      summarySha256: packet.summarySha256,
      sourceDocumentSha256: packet.sourceDocumentSha256,
      decision: "approved",
      reviewerId: index % 2 === 0 ? reviewerA.reviewerId : reviewerB.reviewerId,
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
    claims: Object.freeze(packets.claims.map((packet, index) => ({
      schemaVersion: 1,
      packetId: packet.packetId,
      draftId: packet.draftId,
      claimSha256: packet.claimSha256,
      decision: "approved",
      reviewerId: index % 2 === 0 ? reviewerA.reviewerId : reviewerB.reviewerId,
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
    entities: Object.freeze(packets.entities.map((packet, index) => ({
      schemaVersion: 1,
      packetId: packet.packetId,
      draftId: packet.draftId,
      identitySha256: packet.identitySha256,
      draftSha256: packet.draftSha256,
      decision: "approved",
      reviewerId: index % 2 === 0 ? reviewerA.reviewerId : reviewerB.reviewerId,
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
    relationships: Object.freeze(packets.relationships.map((packet, index) => ({
      schemaVersion: 1,
      packetId: packet.packetId,
      draftId: packet.draftId,
      claimSha256: packet.claimSha256,
      decision: "approved",
      reviewerId: index % 2 === 0 ? reviewerA.reviewerId : reviewerB.reviewerId,
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

const receipts = approvedReceipts();
const planResult = buildHoidEditorialBundlePromotionPlan(
  reviewManifest,
  knowledgeManifest,
  sourceInput,
  receipts,
  progress,
);
if (planResult.status !== "ready-for-protected-review") {
  throw new Error("Complete signed editorial promotion plan fixture unavailable");
}
const plan = planResult.plan;

const context: HoidEditorialBundleReviewContext = Object.freeze({
  schemaVersion: 1,
  repositoryFullName: REPOSITORY,
  pullRequestNumber: 317,
  baseRef: "feat/hoid-ia-core-run316",
  baseSha: "a1060cd1d05db7091d2ea93af916080dd3d27715",
  headRef: "feat/hoid-ia-core-run317",
  headSha: "b".repeat(40),
  promotionManifestPath: "docs/hoid/editorial-bundle-promotion.json",
  promotionPlanFingerprint: plan.fingerprint,
  reviewBundleFingerprint: plan.reviewBundleFingerprint,
});

function fakeSignature(message: string, publicKeyHex: string): string {
  return sha256Hex(message + "|" + publicKeyHex).repeat(2);
}

function createVerifier() {
  return Object.freeze({
    async verify(request: { publicKeyHex: string; message: string; signatureHex: string }) {
      return request.signatureHex === fakeSignature(request.message, request.publicKeyHex);
    },
  });
}

function createRegistry(): HoidReviewerTrustRegistry {
  const unsigned: HoidReviewerTrustRegistryUnsigned = Object.freeze({
    schemaVersion: 1,
    revision: 7,
    issuedAt: "2026-11-01T00:00:00.000Z",
    expiresAt: "2026-12-01T00:00:00.000Z",
    keys: Object.freeze([reviewerA, reviewerB]),
  });
  const message = buildHoidReviewerTrustRegistrySigningMessage(unsigned);
  if (!message) throw new Error("Synthetic reviewer trust registry is invalid");
  return Object.freeze({
    ...unsigned,
    rootSignature: Object.freeze({
      algorithm: "Ed25519",
      keyId: rootKey.keyId,
      signatureHex: fakeSignature(message, rootKey.publicKeyHex),
    }),
  });
}

function createAttestation(
  reviewer: HoidReviewerTrustKey,
  decision: "approve" | "reject" = "approve",
  contextInput: HoidEditorialBundleReviewContext = context,
): HoidEditorialBundleReviewAttestation {
  const message = buildHoidEditorialBundleReviewSigningMessage(
    plan,
    reviewManifest,
    knowledgeManifest,
    sourceInput,
    receipts,
    progress,
    contextInput,
    reviewer.reviewerId,
    decision,
    REVIEWED_AT,
    reviewer.keyId,
  );
  if (!message) throw new Error("Synthetic editorial review signing message is invalid");
  return Object.freeze({
    schemaVersion: 1,
    reviewBundleFingerprint: plan.reviewBundleFingerprint,
    promotionPlanFingerprint: plan.fingerprint,
    reviewerId: reviewer.reviewerId,
    decision,
    reviewedAt: REVIEWED_AT,
    keyId: reviewer.keyId,
    signatureHex: fakeSignature(message, reviewer.publicKeyHex),
  });
}

function createInput(overrides: Record<string, unknown> = {}) {
  return {
    plan,
    reviewManifest,
    knowledgeManifest,
    sourceInput,
    receipts,
    progressSnapshot: progress,
    context,
    attestations: Object.freeze([
      createAttestation(reviewerA),
      createAttestation(reviewerB),
    ]),
    registry: createRegistry(),
    rootKey,
    verifier: createVerifier(),
    now: NOW,
    minimumRegistryRevision: 7,
    ...overrides,
  };
}

describe("Hoid whole-bundle editorial review quorum", () => {
  it("builds a deterministic signing message bound to the reviewed receipts and progress plan", () => {
    const first = buildHoidEditorialBundleReviewSigningMessage(
      plan, reviewManifest, knowledgeManifest, sourceInput, receipts, progress,
      context, reviewerA.reviewerId, "approve", REVIEWED_AT, reviewerA.keyId,
    );
    const second = buildHoidEditorialBundleReviewSigningMessage(
      plan, reviewManifest, knowledgeManifest, sourceInput, receipts, progress,
      context, reviewerA.reviewerId, "approve", REVIEWED_AT, reviewerA.keyId,
    );
    expect(first).toBe(second);
    expect(first).toContain(plan.fingerprint);
    expect(first).toContain(plan.reviewBundleFingerprint);
    expect(first).toContain(plan.progressFingerprint);
    expect(first).not.toContain("Tras la batalla");
  });

  it("verifies two distinct reviewers over the exact review bundle, receipts and progress", async () => {
    const result = await verifyHoidEditorialKnowledgeBundleReviewQuorum(createInput());
    expect(result).toMatchObject({
      status: "verified",
      reviewBundleFingerprint: plan.reviewBundleFingerprint,
      promotionPlanFingerprint: plan.fingerprint,
      progressRevision: plan.progressRevision,
      verifiedReviewerCount: 2,
      reviewerIds: ["reviewer-a", "reviewer-b"],
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  });

  it("rejects a context that names another promotion plan", async () => {
    const result = await verifyHoidEditorialKnowledgeBundleReviewQuorum(createInput({
      context: { ...context, promotionPlanFingerprint: "f".repeat(64) },
    }));
    expect(result).toMatchObject({
      status: "invalid",
      reason: "context-plan-mismatch",
      promotionAllowed: false,
    });
  });

  it("rejects signature replay against a different PR head", async () => {
    const result = await verifyHoidEditorialKnowledgeBundleReviewQuorum(createInput({
      context: { ...context, headSha: "c".repeat(40) },
    }));
    expect(result).toMatchObject({
      status: "invalid",
      reason: "trust-verification-failed",
      trustReason: "signature-invalid",
    });
  });

  it("rejects receipts changed after the promotion plan was built", async () => {
    const changedReceipts = {
      ...receipts,
      summaries: receipts.summaries.map((receipt, index) =>
        index === 0 ? { ...receipt, reviewerId: "different-reviewer" } : receipt,
      ),
    };
    const result = await verifyHoidEditorialKnowledgeBundleReviewQuorum(createInput({
      receipts: changedReceipts,
    }));
    expect(result).toMatchObject({
      status: "invalid",
      reason: "plan-content-mismatch",
      promotionAllowed: false,
    });
  });

  it("rejects a changed authoritative progress snapshot", async () => {
    const result = await verifyHoidEditorialKnowledgeBundleReviewQuorum(createInput({
      progressSnapshot: progressSnapshot(6, 18),
    }));
    expect(result).toMatchObject({
      status: "invalid",
      reason: "plan-content-mismatch",
      promotionAllowed: false,
    });
  });

  it("rejects a one-reviewer quorum", async () => {
    const result = await verifyHoidEditorialKnowledgeBundleReviewQuorum(createInput({
      attestations: Object.freeze([createAttestation(reviewerA)]),
    }));
    expect(result).toMatchObject({ status: "invalid", reason: "invalid-attestations" });
  });

  it("rejects duplicate reviewer identities even when a second key is supplied", async () => {
    const duplicate = Object.freeze({
      ...createAttestation(reviewerB),
      reviewerId: reviewerA.reviewerId,
    });
    const result = await verifyHoidEditorialKnowledgeBundleReviewQuorum(createInput({
      attestations: Object.freeze([createAttestation(reviewerA), duplicate]),
    }));
    expect(result).toMatchObject({ status: "invalid", reason: "invalid-attestations" });
  });

  it("records an authenticated rejection instead of treating it as approval", async () => {
    const result = await verifyHoidEditorialKnowledgeBundleReviewQuorum(createInput({
      attestations: Object.freeze([
        createAttestation(reviewerA, "reject"),
        createAttestation(reviewerB, "approve"),
      ]),
    }));
    expect(result).toMatchObject({
      status: "rejected",
      verifiedReviewerCount: 2,
      reviewerIds: ["reviewer-a", "reviewer-b"],
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  });

  it("rejects an altered reviewer signature", async () => {
    const attestations = [
      createAttestation(reviewerA),
      { ...createAttestation(reviewerB), signatureHex: "0".repeat(128) },
    ];
    const result = await verifyHoidEditorialKnowledgeBundleReviewQuorum(createInput({
      attestations: Object.freeze(attestations),
    }));
    expect(result).toMatchObject({
      status: "invalid",
      reason: "trust-verification-failed",
      trustReason: "signature-invalid",
    });
  });

  it("blocks an incomplete packet receipt set before reviewer quorum", async () => {
    const incompleteReceipts = {
      ...receipts,
      summaries: receipts.summaries.slice(1),
    };
    const result = await verifyHoidEditorialKnowledgeBundleReviewQuorum(createInput({
      receipts: incompleteReceipts,
    }));
    expect(result).toMatchObject({
      status: "blocked",
      reason: "promotion-plan-blocked",
      planReason: "editorial-review-incomplete",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  });

  it("rejects accessor-backed request fields without executing getters", async () => {
    let getterCalled = false;
    const hostile = Object.create(null) as Record<string, unknown>;
    for (const [key, value] of Object.entries(createInput())) {
      Object.defineProperty(hostile, key, {
        enumerable: true,
        configurable: true,
        value,
      });
    }
    Object.defineProperty(hostile, "plan", {
      enumerable: true,
      configurable: true,
      get() {
        getterCalled = true;
        return plan;
      },
    });
    const result = await verifyHoidEditorialKnowledgeBundleReviewQuorum(hostile);
    expect(result).toMatchObject({ status: "invalid", reason: "invalid-input" });
    expect(getterCalled).toBe(false);
  });

  it("rejects a reviewer trust registry below the persisted minimum revision", async () => {
    const result = await verifyHoidEditorialKnowledgeBundleReviewQuorum(createInput({
      minimumRegistryRevision: 8,
    }));
    expect(result).toMatchObject({
      status: "invalid",
      reason: "trust-verification-failed",
      trustReason: "registry-rollback",
    });
  });
});
