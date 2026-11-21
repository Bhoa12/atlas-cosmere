import { describe, expect, it } from "vitest";
import { ed25519 } from "@noble/curves/ed25519.js";
import type { HoidKnowledgeEntry } from "./catalog";
import {
  buildHoidApprovedClaimReviewSigningMessage,
  buildHoidReviewerTrustRegistrySigningMessage,
  type HoidReviewerTrustKey,
  type HoidReviewerTrustRegistryUnsigned,
} from "./editorialReviewSignatures";
import {
  buildHoidTrustRevisionWitnessReceiptSigningMessage,
  type HoidTrustRevisionWitnessReceiptUnsigned,
} from "./remoteTrustRevisionWitness";
import { createHoidApprovedClaimAttestation, type HoidApprovedClaim } from "./approvedClaimIntegrity";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";
import { createHoidRefreshableTrustedReadingProgressPort } from "./trustedPresentationHostAdapters";
import { createHoidTrustedPresentationHost } from "./trustedPresentationHost";

const repository = "Bhoa12/atlas-cosmere";
const now = "2026-11-21T00:00:00.000Z";
const rootSeed = Uint8Array.from(Array.from({ length: 32 }, (_, index) => index + 1));
const reviewerSeed = Uint8Array.from(Array.from({ length: 32 }, (_, index) => index + 65));
const witnessSeed = Uint8Array.from(Array.from({ length: 32 }, (_, index) => index + 129));

function hexFromBytes(value: Uint8Array): string {
  return Array.from(value, byte => byte.toString(16).padStart(2, "0")).join("");
}

function signMessage(message: string, seed: Uint8Array): string {
  return hexFromBytes(ed25519.sign(new TextEncoder().encode(message), seed));
}

const rootKey = Object.freeze({
  keyId: "root-test-2026",
  publicKeyHex: hexFromBytes(ed25519.getPublicKey(rootSeed)),
});
const witnessConfiguration = Object.freeze({
  witnessId: "atlas-test-witness",
  keyId: "witness-test-key",
  publicKeyHex: hexFromBytes(ed25519.getPublicKey(witnessSeed)),
  trustDomainId: "cosmere-main",
});
const reviewerKey: HoidReviewerTrustKey = Object.freeze({
  keyId: "reviewer-test-key",
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
  pullRequestNumber: 198,
  baseRef: "feat/hoid-ia-core-run197",
  baseSha: "c862dce777c2e33beda8a56a9040f5ad327433be",
  headRef: "feat/hoid-ia-core-run198",
  headSha: "d".repeat(40),
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
    revision: chapter,
    positions: [{ bookId: "tfe", cursor: cursor.cursor }],
    updatedAt: now,
  };
}

function signedReceipt(unsigned: HoidTrustRevisionWitnessReceiptUnsigned) {
  const message = buildHoidTrustRevisionWitnessReceiptSigningMessage(unsigned);
  if (!message) throw new Error("Invalid witness receipt fixture");
  return Object.freeze({
    ...unsigned,
    signatureHex: signMessage(message, witnessSeed),
  });
}

function fixture() {
  let witnessRevision = 2;
  let currentProgress: unknown = progress(3);
  let progressReads = 0;
  let nonceCounter = 0;
  let tamperWitnessReceipt = false;

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
    configurationId: "host-config-test",
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
  const witnessTransport = Object.freeze({
    async readMinimumRevision(request: {
      schemaVersion: 1;
      operation: "read-minimum-revision";
      witnessId: string;
      trustDomainId: string;
      requestNonceHex: string;
    }) {
      const receipt = signedReceipt({
        schemaVersion: 1,
        witnessId: request.witnessId,
        keyId: witnessConfiguration.keyId,
        trustDomainId: request.trustDomainId,
        operation: request.operation,
        requestNonceHex: request.requestNonceHex,
        expectedRevision: null,
        nextRevision: null,
        outcome: "read",
        observedRevision: witnessRevision,
        issuedAt: now,
        expiresAt: "2026-11-21T00:00:30.000Z",
      });
      return tamperWitnessReceipt ? { ...receipt, signatureHex: "0".repeat(128) } : receipt;
    },
    async compareAndSetMinimumRevision(request: {
      schemaVersion: 1;
      operation: "compare-and-set-minimum-revision";
      witnessId: string;
      trustDomainId: string;
      expectedRevision: number;
      nextRevision: number;
      requestNonceHex: string;
    }) {
      let outcome: "advanced" | "already-applied" | "conflict";
      if (witnessRevision === request.expectedRevision) {
        witnessRevision = request.nextRevision;
        outcome = "advanced";
      } else if (witnessRevision === request.nextRevision) {
        outcome = "already-applied";
      } else {
        outcome = "conflict";
      }
      return signedReceipt({
        schemaVersion: 1,
        witnessId: request.witnessId,
        keyId: witnessConfiguration.keyId,
        trustDomainId: request.trustDomainId,
        operation: request.operation,
        requestNonceHex: request.requestNonceHex,
        expectedRevision: request.expectedRevision,
        nextRevision: request.nextRevision,
        outcome,
        observedRevision: witnessRevision,
        issuedAt: now,
        expiresAt: "2026-11-21T00:00:30.000Z",
      });
    },
  });
  const noncePort = Object.freeze({
    async createNonceHex() {
      nonceCounter += 1;
      return nonceCounter.toString(16).padStart(64, "0");
    },
  });
  const clock = Object.freeze({ now: () => now });
  const progressRefreshPort = Object.freeze({
    async refresh() {
      progressReads += 1;
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
    bootstrapPort,
    expectedRepositoryFullName: repository,
    witnessConfiguration,
    witnessTransport,
    noncePort,
    clock,
    progressRefreshPort,
  });

  return {
    config,
    answer,
    setProgress(value: unknown) { currentProgress = value; },
    setTamperWitnessReceipt(value: boolean) { tamperWitnessReceipt = value; },
    getProgressReads() { return progressReads; },
  };
}

describe("Hoid trusted presentation host adapters", () => {
  it("uses the durable refresh operation rather than a cached snapshot", async () => {
    const fresh = progress(4);
    let reads = 0;
    const port = createHoidRefreshableTrustedReadingProgressPort({
      getSnapshot() {
        throw new Error("cached snapshot must not be read");
      },
      async refresh() {
        reads += 1;
        return fresh;
      },
    });
    expect(port).not.toBeNull();
    await expect(port!.readProgressSnapshot()).resolves.toEqual(fresh);
    expect(reads).toBe(1);
  });

  it("fails closed when the host refresh returns no valid cursor snapshot", async () => {
    const port = createHoidRefreshableTrustedReadingProgressPort({
      async refresh() {
        return null;
      },
    });
    expect(port).not.toBeNull();
    await expect(port!.readProgressSnapshot()).rejects.toThrow();
  });

  it("rejects accessor-backed refresh methods without invoking their getters", () => {
    let invoked = false;
    const hostile = Object.defineProperty({}, "refresh", {
      enumerable: true,
      get() {
        invoked = true;
        throw new Error("must not execute");
      },
    });
    expect(createHoidRefreshableTrustedReadingProgressPort(hostile)).toBeNull();
    expect(invoked).toBe(false);
  });
});

describe("Hoid trusted presentation host composition", () => {
  it("composes Noble Ed25519, the signed remote witness and fresh local progress end to end", async () => {
    const data = fixture();
    const build = await createHoidTrustedPresentationHost(data.config);
    expect(build.status).toBe("ready");
    if (build.status !== "ready") return;

    expect(build.verifiedClaimCount).toBe(1);
    expect(build.trustRegistryRevision).toBe(3);
    await expect(build.presenter.present(data.answer)).resolves.toMatchObject({
      status: "ready",
      text: "Afirmación editorial aprobada y verificable.",
    });
    expect(data.getProgressReads()).toBe(1);
  });

  it("re-reads SQLite-backed progress for every presentation and withholds after a regression", async () => {
    const data = fixture();
    const build = await createHoidTrustedPresentationHost(data.config);
    expect(build.status).toBe("ready");
    if (build.status !== "ready") return;

    data.setProgress(progress(2));
    await expect(build.presenter.present(data.answer)).resolves.toMatchObject({
      status: "withheld",
      reason: "locked-evidence",
    });
    expect(data.getProgressReads()).toBe(1);
  });

  it("blocks when the signed remote witness receipt cannot be authenticated", async () => {
    const data = fixture();
    data.setTamperWitnessReceipt(true);
    await expect(createHoidTrustedPresentationHost(data.config)).resolves.toMatchObject({
      status: "blocked",
      reason: "trusted-presenter-blocked",
      presenterReason: "revision-store-blocked",
    });
  });

  it("does not construct a host when no authoritative refresh port is supplied", async () => {
    const data = fixture();
    const config = { ...data.config, progressRefreshPort: {} };
    await expect(createHoidTrustedPresentationHost(config)).resolves.toEqual({
      status: "blocked",
      reason: "progress-refresh-unavailable",
    });
  });

  it("keeps the host closed when the signed editorial claim set is empty", async () => {
    const data = fixture();
    const config = { ...data.config, signedClaims: [] };
    await expect(createHoidTrustedPresentationHost(config)).resolves.toEqual({
      status: "blocked",
      reason: "trusted-presenter-blocked",
      presenterReason: "invalid-signed-claims",
    });
  });
});
