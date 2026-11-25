import { describe, expect, it } from "vitest";
import {
  HOID_EDITORIAL_DRAFTS,
} from "./editorialDrafts";
import { HOID_EDITORIAL_CLAIM_DRAFTS } from "./editorialClaimDrafts";
import { HOID_EDITORIAL_ENTITY_DRAFTS } from "./editorialEntityDrafts";
import { HOID_EDITORIAL_RELATIONSHIP_DRAFTS } from "./editorialRelationshipDrafts";
import { buildHoidEditorialKnowledgeBundle } from "./editorialKnowledgeBundle";
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

const now = "2026-11-25T20:00:00.000Z";
const reviewedAt = "2026-11-25T18:00:00.000Z";
const repositoryFullName = "Bhoa12/atlas-cosmere";
const rootKey = Object.freeze({
  keyId: "hoid-review-root-2026",
  publicKeyHex: "11".repeat(32),
});

const sourceInput = Object.freeze({
  summaries: HOID_EDITORIAL_DRAFTS,
  claims: HOID_EDITORIAL_CLAIM_DRAFTS,
  entities: HOID_EDITORIAL_ENTITY_DRAFTS,
  relationships: HOID_EDITORIAL_RELATIONSHIP_DRAFTS,
});

const bundleResult = buildHoidEditorialKnowledgeBundle(sourceInput);
if (bundleResult.status !== "ready-for-review") {
  throw new Error("The checked-in editorial fixture must remain ready for review");
}
const manifest = bundleResult.manifest;

const reviewerA: HoidReviewerTrustKey = Object.freeze({
  keyId: "reviewer-key-a",
  reviewerId: "reviewer-a",
  algorithm: "Ed25519",
  publicKeyHex: "22".repeat(32),
  status: "active",
  validFrom: "2026-01-01T00:00:00.000Z",
  validUntil: "2027-01-01T00:00:00.000Z",
  revokedAt: null,
  allowedRepositoryFullNames: Object.freeze([repositoryFullName]),
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
  allowedRepositoryFullNames: Object.freeze([repositoryFullName]),
});

const context: HoidEditorialBundleReviewContext = Object.freeze({
  schemaVersion: 1,
  repositoryFullName,
  pullRequestNumber: 317,
  baseRef: "feat/hoid-ia-core-run316",
  baseSha: "a1060cd1d05db7091d2ea93af916080dd3d27715",
  headRef: "feat/hoid-ia-core-run317",
  headSha: "b".repeat(40),
  promotionManifestPath: "editorial/promotion-manifest.json",
  promotionPlanFingerprint: "d".repeat(64),
  reviewBundleFingerprint: manifest.fingerprint,
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
    manifest,
    sourceInput,
    contextInput,
    reviewer.reviewerId,
    decision,
    reviewedAt,
    reviewer.keyId,
  );
  if (!message) throw new Error("Synthetic editorial review signing message is invalid");
  return Object.freeze({
    schemaVersion: 1,
    bundleFingerprint: manifest.fingerprint,
    reviewerId: reviewer.reviewerId,
    decision,
    reviewedAt,
    keyId: reviewer.keyId,
    signatureHex: fakeSignature(message, reviewer.publicKeyHex),
  });
}

function createInput(overrides: Record<string, unknown> = {}) {
  return {
    manifest,
    sourceInput,
    context,
    attestations: Object.freeze([
      createAttestation(reviewerA),
      createAttestation(reviewerB),
    ]),
    registry: createRegistry(),
    rootKey,
    verifier: createVerifier(),
    now,
    minimumRegistryRevision: 7,
    ...overrides,
  };
}

describe("Hoid editorial bundle review quorum", () => {
  it("builds a deterministic, bundle-bound signing message without embedding draft prose", () => {
    const first = buildHoidEditorialBundleReviewSigningMessage(
      manifest, sourceInput, context, reviewerA.reviewerId, "approve", reviewedAt, reviewerA.keyId,
    );
    const second = buildHoidEditorialBundleReviewSigningMessage(
      manifest, sourceInput, context, reviewerA.reviewerId, "approve", reviewedAt, reviewerA.keyId,
    );
    expect(first).toBe(second);
    expect(first).toContain(manifest.fingerprint);
    expect(first).toContain(context.headSha);
    expect(first).not.toContain("Tras la batalla");
    expect(first).not.toContain("summary");
  });

  it("verifies two distinct root-trusted reviewers over the exact bundle and PR head", async () => {
    const result = await verifyHoidEditorialKnowledgeBundleReviewQuorum(createInput());
    expect(result).toMatchObject({
      status: "verified",
      bundleFingerprint: manifest.fingerprint,
      registryRevision: 7,
      verifiedReviewerCount: 2,
      reviewerIds: ["reviewer-a", "reviewer-b"],
      promotionAllowed: false,
      productionWritePerformed: false,
    });
    expect(JSON.stringify(result)).not.toContain("Tras la batalla");
  });

  it("rejects a context that names a different bundle fingerprint", async () => {
    const result = await verifyHoidEditorialKnowledgeBundleReviewQuorum(createInput({
      context: { ...context, reviewBundleFingerprint: "f".repeat(64) },
    }));
    expect(result).toMatchObject({
      status: "invalid",
      reason: "context-bundle-mismatch",
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

  it("rejects a bundle manifest paired with a changed staging inventory", async () => {
    const result = await verifyHoidEditorialKnowledgeBundleReviewQuorum(createInput({
      sourceInput: Object.freeze({
        ...sourceInput,
        summaries: Object.freeze(sourceInput.summaries.slice(0, -1)),
      }),
    }));
    expect(result).toMatchObject({
      status: "invalid",
      reason: "invalid-bundle",
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
    const duplicateKey: HoidReviewerTrustKey = Object.freeze({
      ...reviewerB,
      reviewerId: reviewerA.reviewerId,
    });
    const duplicate = Object.freeze({
      ...createAttestation(reviewerB),
      reviewerId: reviewerA.reviewerId,
    });
    expect(duplicateKey.keyId).not.toBe(reviewerA.keyId);
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

  it("blocks a structurally incomplete bundle before considering reviewer votes", async () => {
    const blockedSourceInput = Object.freeze({
      ...sourceInput,
      entities: Object.freeze(sourceInput.entities.filter(item => item.id !== "tfe.vin")),
    });
    const blockedBundle = buildHoidEditorialKnowledgeBundle(blockedSourceInput);
    expect(blockedBundle.status).toBe("blocked");
    if (blockedBundle.status !== "blocked") return;
    const result = await verifyHoidEditorialKnowledgeBundleReviewQuorum(createInput({
      manifest: blockedBundle.manifest,
      sourceInput: blockedSourceInput,
      context: {
        ...context,
        reviewBundleFingerprint: blockedBundle.manifest.fingerprint,
      },
    }));
    expect(result).toMatchObject({
      status: "blocked",
      reason: "bundle-blocked",
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
        value,
      });
    }
    Object.defineProperty(hostile, "manifest", {
      enumerable: true,
      get() {
        getterCalled = true;
        return manifest;
      },
    });
    const result = await verifyHoidEditorialKnowledgeBundleReviewQuorum(hostile);
    expect(result).toMatchObject({ status: "invalid", reason: "invalid-input" });
    expect(getterCalled).toBe(false);
  });

  it("rejects a trust registry below the persisted minimum revision", async () => {
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
