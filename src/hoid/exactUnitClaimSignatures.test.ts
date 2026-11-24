import { describe, expect, it } from "vitest";
import { ed25519 } from "@noble/curves/ed25519.js";
import {
  buildHoidReviewerTrustRegistrySigningMessage,
  type HoidReviewerTrustKey,
  type HoidReviewerTrustRegistryUnsigned,
} from "./editorialReviewSignatures";
import {
  buildHoidExactUnitClaimReviewSigningMessage,
  createHoidSignedExactUnitEvidenceRuntime,
  verifyHoidExactUnitClaimSignatures,
  type HoidSignedExactUnitClaimPackage,
} from "./exactUnitClaimSignatures";
import { createHoidExactApprovedClaimAttestation, type HoidExactEvidenceRecord } from "./exactUnitClaimIntegrity";
import { createHoidChapterReference } from "./chapterReference";
import type { HoidExactUnitEvidencePolicy } from "./unitEvidenceAuthorizationV2";
import { createHoidNobleEd25519VerificationPort } from "./nobleEd25519VerificationAdapter";
import { HoidUnitProgressCoordinator } from "./unitProgressCoordinator";
import { emptyHoidUnitProgressSnapshot, type HoidUnitProgressSnapshot, type HoidUnitProgressStore } from "./unitProgressLedger";

const repository = "Bhoa12/atlas-cosmere";
const now = "2026-11-24T19:00:00.000Z";
const rootSeed = Uint8Array.from(Array.from({ length: 32 }, (_, index) => index + 1));
const reviewerSeed = Uint8Array.from(Array.from({ length: 32 }, (_, index) => index + 65));

function hex(value: Uint8Array): string {
  return Array.from(value, byte => byte.toString(16).padStart(2, "0")).join("");
}

function sign(message: string, seed: Uint8Array): string {
  return hex(ed25519.sign(new TextEncoder().encode(message), seed));
}

const rootKey = Object.freeze({
  keyId: "root-2026",
  publicKeyHex: hex(ed25519.getPublicKey(rootSeed)),
});
const reviewerKey: HoidReviewerTrustKey = Object.freeze({
  keyId: "reviewer-key-1",
  reviewerId: "reviewer-a",
  algorithm: "Ed25519",
  publicKeyHex: hex(ed25519.getPublicKey(reviewerSeed)),
  status: "active",
  validFrom: "2026-01-01T00:00:00.000Z",
  validUntil: "2027-01-01T00:00:00.000Z",
  revokedAt: null,
  allowedRepositoryFullNames: Object.freeze([repository]),
});
const context = Object.freeze({
  schemaVersion: 1 as const,
  repositoryFullName: repository,
  pullRequestNumber: 290,
  baseRef: "feat/hoid-ia-core-run289",
  baseSha: "dcfe310707a70cfae00a33a31b0f1e8344dabc29",
  headRef: "feat/hoid-ia-core-run290",
  headSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  promotionManifestPath: "editorial/promotion-manifest.json",
  promotionPlanFingerprint: "b".repeat(64),
  reviewBundleFingerprint: "c".repeat(64),
});

function reference(bookId: string, chapterNumber: number) {
  const result = createHoidChapterReference(bookId, { chapterNumber });
  if (result.status !== "ready") throw new Error("Synthetic exact reference unavailable");
  return result.reference;
}

const evidence: readonly HoidExactEvidenceRecord[] = Object.freeze([
  Object.freeze({
    id: "evidence.exact-alpha",
    aliases: Object.freeze(["Entidad Alfa"]),
    kind: "character" as const,
    provenance: "verified" as const,
    summary: "Resumen editorial original y sintético para la prueba.",
  }),
]);
const policy: HoidExactUnitEvidencePolicy = Object.freeze({
  schemaVersion: 2,
  evidenceId: "evidence.exact-alpha",
  source: reference("twok", 2),
  firstSafeAppearance: reference("twok", 2),
  unlock: reference("twok", 3),
});
const core = Object.freeze({
  id: "claim.exact-alpha",
  text: "Afirmación editorial sintética vinculada a unidades exactas.",
  intent: "explain" as const,
  evidenceIds: Object.freeze(["evidence.exact-alpha"]),
  entityIds: Object.freeze(["evidence.exact-alpha"]),
});
const attestation = createHoidExactApprovedClaimAttestation(
  core,
  evidence,
  [policy],
  Object.freeze({ reviewerId: "reviewer-a", reviewedAt: "2026-11-18T10:00:00.000Z" }),
);
if (attestation.status !== "valid") throw new Error("Synthetic exact claim attestation failed");
const claim = Object.freeze({
  ...core,
  integrity: attestation.integrity,
  review: attestation.review,
});

function createRegistry(key: HoidReviewerTrustKey = reviewerKey) {
  const unsigned: HoidReviewerTrustRegistryUnsigned = Object.freeze({
    schemaVersion: 1,
    revision: 3,
    issuedAt: "2026-11-01T00:00:00.000Z",
    expiresAt: "2026-12-01T00:00:00.000Z",
    keys: Object.freeze([key]),
  });
  const message = buildHoidReviewerTrustRegistrySigningMessage(unsigned);
  if (!message) throw new Error("Synthetic registry payload invalid");
  return Object.freeze({
    ...unsigned,
    rootSignature: Object.freeze({
      algorithm: "Ed25519" as const,
      keyId: rootKey.keyId,
      signatureHex: sign(message, rootSeed),
    }),
  });
}

function signedPackage(
  packageOverrides: Partial<{ claim: unknown; evidence: unknown; policies: unknown }> = {},
  contextInput: unknown = context,
): HoidSignedExactUnitClaimPackage {
  const unsigned = Object.freeze({
    claim: packageOverrides.claim ?? claim,
    evidence: packageOverrides.evidence ?? evidence,
    policies: packageOverrides.policies ?? [policy],
  });
  const message = buildHoidExactUnitClaimReviewSigningMessage(unsigned, contextInput, reviewerKey.keyId);
  if (!message) throw new Error("Synthetic exact-unit signing message invalid");
  return Object.freeze({
    ...unsigned,
    signature: Object.freeze({
      schemaVersion: 2 as const,
      algorithm: "Ed25519" as const,
      keyId: reviewerKey.keyId,
      signatureHex: sign(message, reviewerSeed),
    }),
  }) as HoidSignedExactUnitClaimPackage;
}

const verifier = createHoidNobleEd25519VerificationPort();

class MemoryStore implements HoidUnitProgressStore {
  value: HoidUnitProgressSnapshot = emptyHoidUnitProgressSnapshot();

  async read(): Promise<unknown> {
    return this.value;
  }

  async compareAndSwap(expectedRevision: number, next: HoidUnitProgressSnapshot): Promise<boolean> {
    if (this.value.revision !== expectedRevision) return false;
    this.value = next;
    return true;
  }
}

describe("Hoid exact-unit reviewer signatures v2", () => {
  it("builds a deterministic, domain-separated message bound to the exact claim and promotion context", () => {
    const bundle = { claim, evidence, policies: [policy] };
    const first = buildHoidExactUnitClaimReviewSigningMessage(bundle, context, reviewerKey.keyId);
    const second = buildHoidExactUnitClaimReviewSigningMessage(bundle, context, reviewerKey.keyId);
    const changedContext = buildHoidExactUnitClaimReviewSigningMessage(
      bundle,
      { ...context, pullRequestNumber: context.pullRequestNumber + 1 },
      reviewerKey.keyId,
    );

    expect(first).toBeTruthy();
    expect(first).toBe(second);
    expect(changedContext).not.toBe(first);
    expect(first).toContain("hoid-exact-unit-approved-claim-review-ed25519-v2");
  });

  it("verifies a valid Ed25519 reviewer signature and the root-signed trust registry", async () => {
    const result = await verifyHoidExactUnitClaimSignatures(
      [signedPackage()],
      context,
      createRegistry(),
      rootKey,
      verifier,
      now,
      1,
    );

    expect(result.status).toBe("verified");
    if (result.status !== "verified") return;
    expect(result.verifiedCount).toBe(1);
    expect(result.registryRevision).toBe(3);
    expect(result.claims[0]).toMatchObject({
      claimId: "claim.exact-alpha",
      reviewerId: "reviewer-a",
      keyId: "reviewer-key-1",
    });
    expect(result.packages[0].claim.id).toBe("claim.exact-alpha");
  });

  it("rejects a changed claim before reviewer signature verification", async () => {
    const signed = signedPackage();
    const changedClaim = Object.freeze({
      ...signed.claim,
      text: "Afirmación modificada después de la revisión.",
    });
    const result = await verifyHoidExactUnitClaimSignatures(
      [{ ...signed, claim: changedClaim }],
      context,
      createRegistry(),
      rootKey,
      verifier,
      now,
      1,
    );
    expect(result).toEqual({ status: "invalid", reason: "invalid-package", index: 0 });
  });

  it("rejects a reviewer signature replayed against another pull request context", async () => {
    const signed = signedPackage();
    const result = await verifyHoidExactUnitClaimSignatures(
      [signed],
      { ...context, pullRequestNumber: context.pullRequestNumber + 1 },
      createRegistry(),
      rootKey,
      verifier,
      now,
      1,
    );
    expect(result).toEqual({ status: "invalid", reason: "signature-invalid", index: 0 });
  });

  it("rejects a revoked reviewer key even when the registry root signature is valid", async () => {
    const revoked = Object.freeze({
      ...reviewerKey,
      status: "revoked" as const,
      revokedAt: "2026-11-20T00:00:00.000Z",
    });
    const result = await verifyHoidExactUnitClaimSignatures(
      [signedPackage()],
      context,
      createRegistry(revoked),
      rootKey,
      verifier,
      now,
      1,
    );
    expect(result).toEqual({ status: "invalid", reason: "key-revoked", index: 0 });
  });

  it("rejects a trust-registry rollback", async () => {
    const result = await verifyHoidExactUnitClaimSignatures(
      [signedPackage()],
      context,
      createRegistry(),
      rootKey,
      verifier,
      now,
      4,
    );
    expect(result).toEqual({ status: "invalid", reason: "registry-rollback" });
  });

  it("rejects a signature envelope with a non-Ed25519 algorithm or malformed signature", async () => {
    const signed = signedPackage();
    const result = await verifyHoidExactUnitClaimSignatures(
      [{ ...signed, signature: { ...signed.signature, algorithm: "RSA", signatureHex: "00" } }],
      context,
      createRegistry(),
      rootKey,
      verifier,
      now,
      1,
    );
    expect(result).toEqual({ status: "invalid", reason: "invalid-signature-envelope", index: 0 });
  });

  it("constructs the exact-unit runtime only after every package signature is verified", async () => {
    const store = new MemoryStore();
    const coordinator = new HoidUnitProgressCoordinator(store);
    const build = await createHoidSignedExactUnitEvidenceRuntime({
      coordinator,
      signedPackages: [signedPackage()],
      context,
      trustRegistry: createRegistry(),
      rootKey,
      verifier,
      now,
      minimumRegistryRevision: 1,
      selector: null,
    });

    expect(build.status).toBe("ready");
    if (build.status !== "ready") return;
    expect(build.verifiedClaimCount).toBe(1);
    expect(build.registryRevision).toBe(3);
    expect(build.runtime).toBeDefined();
  });

  it("does not construct a runtime when a reviewer signature is invalid", async () => {
    const signed = signedPackage();
    const build = await createHoidSignedExactUnitEvidenceRuntime({
      coordinator: new HoidUnitProgressCoordinator(new MemoryStore()),
      signedPackages: [{
        ...signed,
        signature: { ...signed.signature, signatureHex: "0".repeat(128) },
      }],
      context,
      trustRegistry: createRegistry(),
      rootKey,
      verifier,
      now,
      minimumRegistryRevision: 1,
    });

    expect(build).toEqual({
      status: "blocked",
      reason: "signature-verification-failed",
      signatureReason: "signature-invalid",
      index: 0,
    });
  });
});
