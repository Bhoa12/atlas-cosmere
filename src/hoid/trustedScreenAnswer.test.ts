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
import {
  createHoidTrustedVerifiedAnswerPresenter,
  isHoidTrustedVerifiedAnswerPresenter,
} from "./trustedVerifiedAnswerPresentation";
import {
  createHoidTrustedScreenAnswerPort,
  isHoidTrustedScreenAnswerPort,
} from "./trustedScreenAnswer";

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

async function buildTrustedPort(data = fixture()) {
  const build = await createHoidTrustedVerifiedAnswerPresenter(data.config);
  if (build.status !== "ready") throw new Error("Trusted presenter fixture did not verify: " + build.reason);
  const port = createHoidTrustedScreenAnswerPort(build.presenter);
  if (!port) throw new Error("Verified presenter was not accepted by the screen boundary");
  return { data, build, port };
}

describe("Hoid trusted screen answer capability boundary", () => {
  it("accepts a presenter only after root, reviewer, bootstrap and revision verification", async () => {
    const { data, build, port } = await buildTrustedPort();
    expect(isHoidTrustedVerifiedAnswerPresenter(build.presenter)).toBe(true);
    expect(isHoidTrustedScreenAnswerPort(port)).toBe(true);

    await expect(port.present(data.answer, "detailed")).resolves.toMatchObject({
      status: "ready",
      presentation: {
        text: "Afirmación editorial aprobada y verificable.",
        citations: [{
          sourceBookId: "tfe",
          chapter: 1,
          locatorId: locator("tfe", 1),
        }],
      },
      metrics: { claimCount: 1, evidenceCount: 1, workCount: 1 },
    });
  });

  it("rejects a structurally compatible presenter that was not issued by signed verification", () => {
    let invoked = false;
    const forged = Object.freeze({
      async present() {
        invoked = true;
        return { status: "ready" };
      },
    });

    expect(isHoidTrustedVerifiedAnswerPresenter(forged)).toBe(false);
    expect(createHoidTrustedScreenAnswerPort(forged)).toBeNull();
    expect(invoked).toBe(false);
  });

  it("rejects a proxy or copied presenter even when it exposes the same method", async () => {
    const { build } = await buildTrustedPort();
    const proxied = new Proxy(build.presenter, {});
    const copied = Object.freeze({ present: build.presenter.present });

    expect(isHoidTrustedVerifiedAnswerPresenter(proxied)).toBe(false);
    expect(isHoidTrustedVerifiedAnswerPresenter(copied)).toBe(false);
    expect(createHoidTrustedScreenAnswerPort(proxied)).toBeNull();
    expect(createHoidTrustedScreenAnswerPort(copied)).toBeNull();
  });

  it("brands the exact screen port instance and rejects structural port injection", async () => {
    const { port } = await buildTrustedPort();
    const copied = Object.freeze({ present: port.present });
    const forged = Object.freeze({ present: async () => ({ status: "ready" }) });

    expect(isHoidTrustedScreenAnswerPort(port)).toBe(true);
    expect(isHoidTrustedScreenAnswerPort(copied)).toBe(false);
    expect(isHoidTrustedScreenAnswerPort(forged)).toBe(false);
  });

  it("rejects an accessor-backed presenter without invoking its getter", () => {
    let invoked = false;
    const hostile = Object.defineProperty({}, "present", {
      enumerable: true,
      get() {
        invoked = true;
        throw new Error("must not run");
      },
    });

    expect(createHoidTrustedScreenAnswerPort(hostile)).toBeNull();
    expect(invoked).toBe(false);
  });

  it("withholds an answer when the trusted registry revision advances", async () => {
    const { data, port } = await buildTrustedPort();
    data.setRevision(4);

    await expect(port.present(data.answer, "brief")).resolves.toMatchObject({
      status: "withheld",
      reason: "presenter-withheld",
    });
  });

  it("withholds chapter evidence when the authoritative progress moves behind its unlock", async () => {
    const { data, port } = await buildTrustedPort();
    data.setProgress(2);

    await expect(port.present(data.answer, "brief")).resolves.toMatchObject({
      status: "withheld",
      reason: "presenter-withheld",
    });
  });

  it("rejects an invalid explanation depth before attempting presentation", async () => {
    const { data, port } = await buildTrustedPort();

    await expect(port.present(data.answer, "spoiler-mode")).resolves.toMatchObject({
      status: "withheld",
      reason: "invalid-depth",
    });
  });

  it("does not create a screen port when the signed presenter build is blocked", async () => {
    const data = fixture();
    const blocked = await createHoidTrustedVerifiedAnswerPresenter({
      ...data.config,
      signedClaims: [],
    });

    expect(blocked).toMatchObject({ status: "blocked", reason: "invalid-signed-claims" });
    expect(createHoidTrustedScreenAnswerPort({ present: async () => ({ status: "ready" }) })).toBeNull();
  });
});
