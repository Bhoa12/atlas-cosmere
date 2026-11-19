import { describe, expect, it } from "vitest";
import type { HoidKnowledgeEntry } from "./catalog";
import {
  buildHoidApprovedClaimReviewSigningMessage,
  buildHoidReviewerTrustRegistrySigningMessage,
  createHoidWebCryptoEd25519VerificationPort,
  verifyHoidApprovedClaimReviewSignature,
  verifyHoidReviewerTrustRegistry,
  type HoidReviewerTrustKey,
  type HoidReviewerTrustRegistryUnsigned,
} from "./editorialReviewSignatures";
import { createHoidApprovedClaimAttestation } from "./approvedClaimIntegrity";
import { getHoidReadingManifest } from "./readingManifest";
import { sha256Hex } from "./sha256";

const now = "2026-11-19T09:00:00.000Z";
const rootKey = Object.freeze({
  keyId: "root-2026",
  publicKeyHex: "11".repeat(32),
});
const reviewerKey: HoidReviewerTrustKey = Object.freeze({
  keyId: "reviewer-key-1",
  reviewerId: "reviewer-a",
  algorithm: "Ed25519",
  publicKeyHex: "22".repeat(32),
  status: "active",
  validFrom: "2026-01-01T00:00:00.000Z",
  validUntil: "2027-01-01T00:00:00.000Z",
  revokedAt: null,
  allowedRepositoryFullNames: Object.freeze(["Bhoa12/atlas-cosmere"]),
});
const context = Object.freeze({
  schemaVersion: 1 as const,
  repositoryFullName: "Bhoa12/atlas-cosmere",
  pullRequestNumber: 48,
  baseRef: "feat/hoid-ia-core-run154",
  baseSha: "eb677294e4c328bd25a91d91a1428d26511a38f3",
  headRef: "feat/hoid-ia-core-run155",
  headSha: "a".repeat(40),
  promotionManifestPath: "editorial/promotion-manifest.json",
  promotionPlanFingerprint: "b".repeat(64),
  reviewBundleFingerprint: "c".repeat(64),
});

function locator(bookId: string, chapter: number): string {
  const result = getHoidReadingManifest(bookId);
  if (result.status !== "ready") throw new Error("Synthetic manifest unavailable");
  const unit = result.manifest.units.find(candidate => candidate.chapterNumber === chapter);
  if (!unit?.locatorId) throw new Error("Synthetic locator unavailable");
  return unit.locatorId;
}

const knowledge: HoidKnowledgeEntry[] = [{
  id: "e-alpha",
  aliases: ["Entidad Alfa"],
  kind: "character",
  firstSafeAppearance: { bookId: "twok", chapter: 2 },
  evidenceSource: { bookId: "twok", chapter: 2, locatorId: locator("twok", 2) },
  evidenceUnlock: { bookId: "twok", chapter: 3 },
  provenance: "verified",
  summary: "Resumen editorial sintético sin datos narrativos protegidos.",
}];

const core = Object.freeze({
  id: "claim-alpha",
  text: "Afirmación editorial sintética con procedencia verificable.",
  intent: "explain" as const,
  evidenceIds: Object.freeze(["e-alpha"]),
  entityIds: Object.freeze(["e-alpha"]),
});

const attestationResult = createHoidApprovedClaimAttestation(
  core,
  knowledge,
  Object.freeze({ reviewerId: "reviewer-a", reviewedAt: "2026-11-18T10:00:00.000Z" }),
);
if (attestationResult.status !== "valid") throw new Error("Synthetic claim attestation failed");
const claim = Object.freeze({
  ...core,
  integrity: attestationResult.integrity,
  review: attestationResult.review,
});

function fakeSignature(message: string, publicKeyHex: string): string {
  return sha256Hex(message + "|" + publicKeyHex).repeat(2);
}

function createFakeVerifier() {
  return Object.freeze({
    async verify(input: { publicKeyHex: string; message: string; signatureHex: string }) {
      return input.signatureHex === fakeSignature(input.message, input.publicKeyHex);
    },
  });
}

function createRegistry(overrides: Partial<HoidReviewerTrustKey> = {}) {
  const key = Object.freeze({ ...reviewerKey, ...overrides });
  const unsigned: HoidReviewerTrustRegistryUnsigned = Object.freeze({
    schemaVersion: 1,
    revision: 3,
    issuedAt: "2026-11-01T00:00:00.000Z",
    expiresAt: "2026-12-01T00:00:00.000Z",
    keys: Object.freeze([key]),
  });
  const message = buildHoidReviewerTrustRegistrySigningMessage(unsigned);
  if (!message) throw new Error("Synthetic trust registry payload invalid");
  return Object.freeze({
    ...unsigned,
    rootSignature: Object.freeze({
      algorithm: "Ed25519" as const,
      keyId: rootKey.keyId,
      signatureHex: fakeSignature(message, rootKey.publicKeyHex),
    }),
  });
}

function createClaimSignature(registry = createRegistry(), contextInput: unknown = context) {
  const message = buildHoidApprovedClaimReviewSigningMessage(
    claim,
    knowledge,
    contextInput,
    reviewerKey.keyId,
  );
  if (!message) throw new Error("Synthetic claim signing payload invalid");
  return Object.freeze({
    schemaVersion: 1 as const,
    algorithm: "Ed25519" as const,
    keyId: reviewerKey.keyId,
    signatureHex: fakeSignature(message, reviewerKey.publicKeyHex),
  });
}

describe("Hoid cryptographic editorial review trust", () => {
  it("verifies a root-signed trust registry before accepting reviewer keys", async () => {
    const registry = createRegistry();
    const result = await verifyHoidReviewerTrustRegistry(
      registry,
      rootKey,
      createFakeVerifier(),
      now,
      1,
    );
    expect(result).toEqual({
      status: "verified",
      revision: 3,
      keyCount: 1,
      expiresAt: "2026-12-01T00:00:00.000Z",
    });
  });

  it("rejects a correctly signed registry older than the persisted minimum revision", async () => {
    const registry = createRegistry();
    expect(await verifyHoidReviewerTrustRegistry(
      registry,
      rootKey,
      createFakeVerifier(),
      now,
      4,
    )).toEqual({ status: "invalid", reason: "registry-rollback" });
  });

  it("requires a valid persisted minimum registry revision", async () => {
    const registry = createRegistry();
    expect(await verifyHoidReviewerTrustRegistry(
      registry,
      rootKey,
      createFakeVerifier(),
      now,
      0,
    )).toEqual({ status: "invalid", reason: "invalid-minimum-revision" });
  });

  it("rejects a trust registry whose root signature was changed", async () => {
    const registry = createRegistry();
    const tampered = {
      ...registry,
      rootSignature: { ...registry.rootSignature, signatureHex: "0".repeat(128) },
    };
    expect(await verifyHoidReviewerTrustRegistry(
      tampered,
      rootKey,
      createFakeVerifier(),
      now,
      1,
    )).toEqual({ status: "invalid", reason: "registry-signature-invalid" });
  });

  it("rejects a registry that is expired, future-dated or longer than the 90-day policy", async () => {
    const expired = createRegistry();
    expect((await verifyHoidReviewerTrustRegistry(
      { ...expired, expiresAt: "2026-11-18T00:00:00.000Z" },
      rootKey,
      createFakeVerifier(),
      now,
      1,
    )).status).toBe("invalid");

    const future = createRegistry();
    expect((await verifyHoidReviewerTrustRegistry(
      { ...future, issuedAt: "2026-11-20T00:00:00.000Z" },
      rootKey,
      createFakeVerifier(),
      now,
      1,
    )).status).toBe("invalid");

    const longLived = createRegistry();
    expect(await verifyHoidReviewerTrustRegistry(
      { ...longLived, expiresAt: "2027-03-01T00:00:00.000Z" },
      rootKey,
      createFakeVerifier(),
      now,
      1,
    )).toEqual({ status: "invalid", reason: "registry-lifetime-exceeded" });
  });

  it("verifies a claim signature bound to the exact PR head, plan, bundle and claim digests", async () => {
    const registry = createRegistry();
    const signature = createClaimSignature(registry);
    const result = await verifyHoidApprovedClaimReviewSignature(
      claim, knowledge, context, signature, registry, rootKey, createFakeVerifier(), now,
      3,
    );
    expect(result).toMatchObject({
      status: "verified",
      claimId: "claim-alpha",
      reviewerId: "reviewer-a",
      keyId: "reviewer-key-1",
      registryRevision: 3,
      statementSha256: claim.integrity.statementSha256,
      claimSha256: claim.integrity.claimSha256,
      evidenceSha256: claim.integrity.evidenceSha256,
      reviewSha256: claim.integrity.reviewSha256,
    });
  });

  it("rejects replay against a different PR head or promotion plan", async () => {
    const registry = createRegistry();
    const signature = createClaimSignature(registry);
    const changedHead = { ...context, headSha: "d".repeat(40) };
    const changedPlan = { ...context, promotionPlanFingerprint: "e".repeat(64) };
    expect((await verifyHoidApprovedClaimReviewSignature(
      claim, knowledge, changedHead, signature, registry, rootKey, createFakeVerifier(), now,
      3,
    )).status).toBe("invalid");
    expect((await verifyHoidApprovedClaimReviewSignature(
      claim, knowledge, changedPlan, signature, registry, rootKey, createFakeVerifier(), now,
      3,
    )).status).toBe("invalid");
  });

  it("rejects a key whose reviewer identity does not match the reviewed claim", async () => {
    const registry = createRegistry({ reviewerId: "reviewer-b" });
    const signature = createClaimSignature(registry);
    expect(await verifyHoidApprovedClaimReviewSignature(
      claim, knowledge, context, signature, registry, rootKey, createFakeVerifier(), now,
      3,
    )).toEqual({ status: "invalid", reason: "reviewer-key-mismatch" });
  });

  it("rejects revoked, expired and repository-scoped-out reviewer keys", async () => {
    const revoked = createRegistry({
      status: "revoked",
      revokedAt: "2026-11-10T00:00:00.000Z",
    });
    expect((await verifyHoidApprovedClaimReviewSignature(
      claim, knowledge, context, createClaimSignature(revoked), revoked,
      rootKey, createFakeVerifier(), now,
      3,
    )).reason).toBe("key-revoked");

    const expired = createRegistry({
      validUntil: "2026-11-18T00:00:00.000Z",
    });
    expect((await verifyHoidApprovedClaimReviewSignature(
      claim, knowledge, context, createClaimSignature(expired), expired,
      rootKey, createFakeVerifier(), now,
      3,
    )).reason).toBe("key-not-current");

    const otherRepository = createRegistry({
      allowedRepositoryFullNames: Object.freeze(["other/repository"]),
    });
    expect((await verifyHoidApprovedClaimReviewSignature(
      claim, knowledge, context, createClaimSignature(otherRepository), otherRepository,
      rootKey, createFakeVerifier(), now,
      3,
    )).reason).toBe("repository-not-authorized");
  });

  it("rejects a claim changed after its source-bound SHA-256 attestation", async () => {
    const registry = createRegistry();
    const signature = createClaimSignature(registry);
    const changed = { ...claim, text: "Texto alterado tras la revisión." };
    expect(await verifyHoidApprovedClaimReviewSignature(
      changed, knowledge, context, signature, registry, rootKey, createFakeVerifier(), now,
      3,
    )).toEqual({ status: "invalid", reason: "invalid-claim" });
  });

  it("rejects a malformed registry and an unavailable crypto port", async () => {
    const registry = createRegistry();
    expect((await verifyHoidReviewerTrustRegistry(
      { ...registry, unexpected: true },
      rootKey,
      createFakeVerifier(),
      now,
      1,
    )).status).toBe("invalid");
    expect(await verifyHoidReviewerTrustRegistry(
      registry,
      rootKey,
      {},
      now,
      1,
    )).toEqual({ status: "invalid", reason: "verifier-unavailable" });
  });

  it("verifies the RFC 8032 Ed25519 test vector through the WebCrypto adapter", async () => {
    if (!globalThis.crypto?.subtle || typeof TextEncoder === "undefined") return;
    const verifier = createHoidWebCryptoEd25519VerificationPort(globalThis.crypto.subtle);
    const vector = {
      publicKeyHex: "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
      signatureHex:
        "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e06522490155" +
        "5fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b",
    };
    expect(await verifier.verify({ ...vector, message: "" })).toBe(true);
    expect(await verifier.verify({ ...vector, message: "tampered" })).toBe(false);
  });
});
