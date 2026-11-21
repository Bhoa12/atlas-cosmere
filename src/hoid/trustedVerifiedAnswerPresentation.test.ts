import { describe, expect, it } from "vitest";
import { ed25519 } from "@noble/curves/ed25519.js";
import type { HoidKnowledgeEntry } from "./catalog";
import {
  buildHoidApprovedClaimReviewSigningMessage,
  buildHoidReviewerTrustRegistrySigningMessage,
  type HoidReviewerTrustKey,
  type HoidReviewerTrustRegistryUnsigned,
} from "./editorialReviewSignatures";
import { createHoidApprovedClaimAttestation, type HoidApprovedClaim } from "./approvedClaimIntegrity";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";
import { createHoidNobleEd25519VerificationPort } from "./nobleEd25519VerificationAdapter";
import { createHoidTrustedVerifiedAnswerPresenter } from "./trustedVerifiedAnswerPresentation";

const repository = "Bhoa12/atlas-cosmere";
const now = "2026-11-20T12:00:00.000Z";
const rootSeed = Uint8Array.from(Array.from({ length: 32 }, (_, index) => index + 1));
const reviewerSeed = Uint8Array.from(Array.from({ length: 32 }, (_, index) => index + 65));

function hexFromBytes(value: Uint8Array): string {
  return Array.from(value, byte => byte.toString(16).padStart(2, "0")).join("");
}

function signMessage(message: string, seed: Uint8Array): string {
  return hexFromBytes(ed25519.sign(new TextEncoder().encode(message), seed));
}

const rootKey = Object.freeze({
  keyId: "root-2026",
  publicKeyHex: hexFromBytes(ed25519.getPublicKey(rootSeed)),
});
const reviewerKey: HoidReviewerTrustKey = Object.freeze({
  keyId: "reviewer-key-1",
  reviewerId: "reviewer-a",
  algorithm: "Ed25519",
  publicKeyHex: hexFromBytes(ed25519.getPublicKey(reviewerSeed)),
  status: "active",
  validFrom: "2026-01-01T00:00:00.000Z",
  validUntil: "2027-01-01T00:00:00.000Z",
  revokedAt: null,
  allowedRepositoryFullNames: Object.freeze([repository]),
});
const context = Object.freeze({
  schemaVersion: 1 as const,
  repositoryFullName: repository,
  pullRequestNumber: 196,
  baseRef: "feat/hoid-ia-core-run195",
  baseSha: "b8c17f638bc6ed738f18934b3f511479dff7371c",
  headRef: "feat/hoid-ia-core-run196",
  headSha: "c".repeat(40),
  promotionManifestPath: "editorial/promotion-manifest.json",
  promotionPlanFingerprint: "b".repeat(64),
  reviewBundleFingerprint: "c".repeat(64),
});

function locator(bookId: string, chapter: number): string {
  const manifest = getHoidReadingManifest(bookId);
  if (manifest.status !== "ready") throw new Error("Manifest unavailable");
  const unit = manifest.manifest.units.find(item => item.chapterNumber === chapter);
  if (!unit?.locatorId) throw new Error("Locator unavailable");
  return unit.locatorId;
}

function progress(chapter: number) {
  const cursor = createHoidReadingCursor("tfe", chapter);
  if (cursor.status !== "ready") throw new Error("Cursor unavailable");
  return {
    schemaVersion: 2,
    revision: 1,
    positions: [{ bookId: "tfe", cursor: cursor.cursor }],
    updatedAt: now,
  };
}

function fixture(initialRevision = 2) {
  let currentRevision = initialRevision;
  let currentNow = now;
  let currentProgress = progress(3);
  const knowledge: HoidKnowledgeEntry[] = [{
    id: "evidence-alpha",
    aliases: ["Personaje Alfa"],
    kind: "character",
    firstSafeAppearance: { bookId: "tfe", chapter: 1 },
    evidenceSource: { bookId: "tfe", chapter: 1, locatorId: locator("tfe", 1) },
    evidenceUnlock: { bookId: "tfe", chapter: 2 },
    provenance: "verified",
    summary: "Resumen editorial original de prueba.",
  }];
  const core = Object.freeze({
    id: "claim-alpha",
    text: "Afirmación editorial aprobada y verificable.",
    intent: "explain" as const,
    evidenceIds: Object.freeze(["evidence-alpha"]),
  });
  const attestation = createHoidApprovedClaimAttestation(
    core,
    knowledge,
    Object.freeze({ reviewerId: "reviewer-a", reviewedAt: "2026-11-18T10:00:00.000Z" }),
  );
  if (attestation.status !== "valid") throw new Error("Synthetic claim attestation failed");
  const claim: HoidApprovedClaim = Object.freeze({
    ...core,
    integrity: attestation.integrity,
    review: attestation.review,
  });
  const claimMessage = buildHoidApprovedClaimReviewSigningMessage(
    claim,
    knowledge,
    context,
    reviewerKey.keyId,
  );
  if (!claimMessage) throw new Error("Claim signing message invalid");
  const signature = Object.freeze({
    schemaVersion: 1 as const,
    algorithm: "Ed25519" as const,
    keyId: reviewerKey.keyId,
    signatureHex: signMessage(claimMessage, reviewerSeed),
  });

  const unsignedRegistry: HoidReviewerTrustRegistryUnsigned = Object.freeze({
    schemaVersion: 1,
    revision: 3,
    issuedAt: "2026-11-01T00:00:00.000Z",
    expiresAt: "2026-12-01T00:00:00.000Z",
    keys: Object.freeze([reviewerKey]),
  });
  const registryMessage = buildHoidReviewerTrustRegistrySigningMessage(unsignedRegistry);
  if (!registryMessage) throw new Error("Trust registry signing message invalid");
  const trustRegistry = Object.freeze({
    ...unsignedRegistry,
    rootSignature: Object.freeze({
      algorithm: "Ed25519" as const,
      keyId: rootKey.keyId,
      signatureHex: signMessage(registryMessage, rootSeed),
    }),
  });

  const bootstrapConfiguration = Object.freeze({
    schemaVersion: 1,
    configurationId: "host-config-1",
    trustDomainId: "cosmere-main",
    rootKey,
    minimumRegistryRevision: 2,
    allowedRepositoryFullNames: Object.freeze([repository]),
    provisionedAt: "2026-11-01T00:00:00.000Z",
    expiresAt: "2026-12-01T00:00:00.000Z",
  });
  const bootstrapPort = Object.freeze({
    async readPinnedConfiguration() {
      return bootstrapConfiguration;
    },
  });
  const revisionStore = Object.freeze({
    async readMinimumRevision(input: { trustDomainId: string }) {
      return input.trustDomainId === "cosmere-main" ? currentRevision : null;
    },
    async compareAndSetMinimumRevision(input: {
      trustDomainId: string;
      expectedRevision: number;
      nextRevision: number;
    }) {
      if (input.trustDomainId !== "cosmere-main" || currentRevision !== input.expectedRevision) return false;
      currentRevision = input.nextRevision;
      return true;
    },
  });
  const verifier = createHoidNobleEd25519VerificationPort();
  const clock = Object.freeze({ now: () => currentNow });
  const progressPort = Object.freeze({
    async readProgressSnapshot() {
      return currentProgress;
    },
  });
  const answer = Object.freeze({
    status: "authorized",
    text: claim.text,
    claimIds: Object.freeze([claim.id]),
    evidenceIds: Object.freeze(["evidence-alpha"]),
    sources: Object.freeze([Object.freeze({
      evidenceId: "evidence-alpha",
      sourceBookId: "tfe",
      sourceChapter: 1,
      locatorId: locator("tfe", 1),
      unlockBookId: "tfe",
      unlockChapter: 2,
    })]),
    segments: Object.freeze([Object.freeze({
      claimId: claim.id,
      text: claim.text,
      evidenceIds: Object.freeze(["evidence-alpha"]),
    })]),
    layout: "plain",
  });
  const config = Object.freeze({
    knowledge,
    signedClaims: Object.freeze([Object.freeze({ claim, signature })]),
    context,
    trustRegistry,
    verifier,
    bootstrapPort,
    revisionStore,
    progressPort,
    expectedRepositoryFullName: repository,
    clock,
  });
  return {
    config,
    answer,
    setNow(value: string) { currentNow = value; },
    setRevision(value: number) { currentRevision = value; },
    setProgress(chapter: number) { currentProgress = progress(chapter); },
  };
}

describe("Hoid trusted verified answer presentation", () => {
  it("requires a host-pinned root, a persisted trust revision and a valid reviewer signature", async () => {
    const data = fixture();
    const result = await createHoidTrustedVerifiedAnswerPresenter(data.config);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.verifiedClaimCount).toBe(1);
    expect(result.trustRegistryRevision).toBe(3);
    expect(await result.presenter.present(data.answer)).toMatchObject({
      status: "ready",
      text: "Afirmación editorial aprobada y verificable.",
    });
  });

  it("rejects a reviewer signature changed after the claim was signed", async () => {
    const data = fixture();
    const config = {
      ...data.config,
      signedClaims: [{
        claim: data.config.signedClaims[0].claim,
        signature: { ...data.config.signedClaims[0].signature, signatureHex: "0".repeat(128) },
      }],
    };
    expect(await createHoidTrustedVerifiedAnswerPresenter(config)).toEqual({
      status: "blocked",
      reason: "signature-verification-failed",
    });
  });

  it("rejects a signature replayed against a different pull-request head", async () => {
    const data = fixture();
    const config = { ...data.config, context: { ...context, headSha: "d".repeat(40) } };
    expect(await createHoidTrustedVerifiedAnswerPresenter(config)).toEqual({
      status: "blocked",
      reason: "signature-verification-failed",
    });
  });

  it("rejects a trust registry whose root signature has been changed", async () => {
    const data = fixture();
    const config = {
      ...data.config,
      trustRegistry: {
        ...data.config.trustRegistry,
        rootSignature: { ...data.config.trustRegistry.rootSignature, signatureHex: "0".repeat(128) },
      },
    };
    expect(await createHoidTrustedVerifiedAnswerPresenter(config)).toEqual({
      status: "blocked",
      reason: "registry-persistence-blocked",
    });
  });

  it("rejects an uninitialized or rolled-back durable revision store", async () => {
    const data = fixture(1);
    expect(await createHoidTrustedVerifiedAnswerPresenter(data.config)).toEqual({
      status: "blocked",
      reason: "revision-store-blocked",
    });
  });

  it("rejects a context from another repository", async () => {
    const data = fixture();
    const config = { ...data.config, expectedRepositoryFullName: "Other/repository" };
    expect(await createHoidTrustedVerifiedAnswerPresenter(config)).toEqual({
      status: "blocked",
      reason: "invalid-signed-claims",
    });
  });

  it("invalidates a presenter when a newer trust-registry revision is persisted", async () => {
    const data = fixture();
    const result = await createHoidTrustedVerifiedAnswerPresenter(data.config);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    data.setRevision(4);
    expect(await result.presenter.present(data.answer)).toMatchObject({
      status: "withheld",
      reason: "not-authorized",
    });
  });

  it("invalidates a presenter when its signed trust registry expires", async () => {
    const data = fixture();
    const result = await createHoidTrustedVerifiedAnswerPresenter(data.config);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    data.setNow("2026-12-02T00:00:00.000Z");
    expect(await result.presenter.present(data.answer)).toMatchObject({
      status: "withheld",
      reason: "not-authorized",
    });
  });

  it("still enforces the per-work chapter unlock after cryptographic review succeeds", async () => {
    const data = fixture();
    const result = await createHoidTrustedVerifiedAnswerPresenter(data.config);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    data.setProgress(2);
    expect(await result.presenter.present(data.answer)).toMatchObject({
      status: "withheld",
      reason: "locked-evidence",
    });
  });

  it("fails closed on accessor-based configuration without evaluating the getter", async () => {
    const data = fixture();
    let invoked = false;
    const config = { ...data.config } as Record<string, unknown>;
    Object.defineProperty(config, "clock", {
      enumerable: true,
      get() {
        invoked = true;
        return data.config.clock;
      },
    });
    expect(await createHoidTrustedVerifiedAnswerPresenter(config)).toEqual({
      status: "blocked",
      reason: "invalid-config",
    });
    expect(invoked).toBe(false);
  });

  it("rejects an empty signed-claim set rather than constructing a permissive presenter", async () => {
    const data = fixture();
    const config = { ...data.config, signedClaims: [] };
    expect(await createHoidTrustedVerifiedAnswerPresenter(config)).toEqual({
      status: "blocked",
      reason: "invalid-signed-claims",
    });
  });

  it("ignores caller-supplied progress and reads only the host progress port", async () => {
    const data = fixture();
    const result = await createHoidTrustedVerifiedAnswerPresenter(data.config);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    data.setProgress(2);
    const call = result.presenter.present as unknown as (answer: unknown, forgedProgress: unknown) => Promise<unknown>;
    expect(await call(data.answer, progress(3))).toMatchObject({
      status: "withheld",
      reason: "locked-evidence",
    });
  });

  it("withholds when the authoritative progress port fails", async () => {
    const data = fixture();
    const config = {
      ...data.config,
      progressPort: { async readProgressSnapshot() { throw new Error("progress store unavailable"); } },
    };
    const result = await createHoidTrustedVerifiedAnswerPresenter(config);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(await result.presenter.present(data.answer)).toMatchObject({
      status: "withheld",
      reason: "not-authorized",
    });
  });

});