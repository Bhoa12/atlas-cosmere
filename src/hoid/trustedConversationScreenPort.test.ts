import { describe, expect, it } from "vitest";
import { ed25519 } from "@noble/curves/ed25519.js";
import {
  buildHoidReviewerTrustRegistrySigningMessage,
  type HoidReviewerTrustKey,
  type HoidReviewerTrustRegistryUnsigned,
} from "./editorialReviewSignatures";
import {
  buildHoidExactUnitClaimReviewSigningMessage,
  type HoidSignedExactUnitClaimPackage,
} from "./exactUnitClaimSignatures";
import {
  createHoidExactApprovedClaimAttestation,
  type HoidExactEvidenceRecord,
} from "./exactUnitClaimIntegrity";
import { createHoidChapterReference } from "./chapterReference";
import { createHoidUnitProgressCursor } from "./unitProgressCursor";
import { createHoidNobleEd25519VerificationPort } from "./nobleEd25519VerificationAdapter";
import { HoidUnitProgressCoordinator } from "./unitProgressCoordinator";
import {
  type HoidUnitProgressSnapshot,
  type HoidUnitProgressStore,
} from "./unitProgressLedger";
import {
  createHoidTrustedConversationComposition,
  isHoidTrustedConversationComposition,
} from "./trustedConversationComposition";
import {
  createHoidTrustedConversationScreenPort,
  isHoidTrustedConversationScreenPort,
} from "./trustedConversationScreenPort";
import type {
  HoidReviewerTrustCheckpoint,
  HoidReviewerTrustCheckpointStore,
  HoidReviewerTrustRegistrySource,
  HoidSignedClaimPackageSource,
} from "./trustedExactUnitAnswerHost";
import type { HoidExactClaimSelectionRequest } from "./exactUnitEvidenceRuntime";

const repository = "Bhoa12/atlas-cosmere";
const now = "2026-11-25T00:00:00.000Z";
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
  pullRequestNumber: 296,
  baseRef: "feat/hoid-ia-core-run295",
  baseSha: "e60cc3265ed20d1f0b33f479759b944e40fdb6e0",
  headRef: "feat/hoid-ia-core-run296",
  headSha: "d".repeat(40),
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
const policy = Object.freeze({
  schemaVersion: 2 as const,
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

function signedPackage(): HoidSignedExactUnitClaimPackage {
  const attestation = createHoidExactApprovedClaimAttestation(
    core,
    evidence,
    [policy],
    Object.freeze({ reviewerId: "reviewer-a", reviewedAt: "2026-11-24T18:00:00.000Z" }),
  );
  if (attestation.status !== "valid") throw new Error("Synthetic exact claim attestation failed");
  const claim = Object.freeze({
    ...core,
    integrity: attestation.integrity,
    review: attestation.review,
  });
  const unsigned = Object.freeze({
    claim,
    evidence,
    policies: Object.freeze([policy]),
  });
  const message = buildHoidExactUnitClaimReviewSigningMessage(unsigned, context, reviewerKey.keyId);
  if (!message) throw new Error("Synthetic exact-unit signing message invalid");
  return Object.freeze({
    ...unsigned,
    signature: Object.freeze({
      schemaVersion: 2 as const,
      algorithm: "Ed25519" as const,
      keyId: reviewerKey.keyId,
      signatureHex: sign(message, reviewerSeed),
    }),
  });
}

function signedRegistry() {
  const unsigned: HoidReviewerTrustRegistryUnsigned = Object.freeze({
    schemaVersion: 1,
    revision: 3,
    issuedAt: "2026-11-24T18:00:00.000Z",
    expiresAt: "2026-12-01T00:00:00.000Z",
    keys: Object.freeze([reviewerKey]),
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

function snapshot(chapterNumber: number, revision: number): HoidUnitProgressSnapshot {
  const cursor = createHoidUnitProgressCursor("twok", { chapterNumber });
  if (cursor.status !== "ready") throw new Error("Synthetic progress cursor unavailable");
  return Object.freeze({
    schemaVersion: 3,
    revision,
    positions: Object.freeze([Object.freeze({ bookId: "twok", cursor: cursor.cursor })]),
    updatedAt: now,
  });
}

class MemoryProgressStore implements HoidUnitProgressStore {
  value: HoidUnitProgressSnapshot = snapshot(4, 1);
  async read(): Promise<unknown> { return this.value; }
  async compareAndSwap(expectedRevision: number, next: HoidUnitProgressSnapshot): Promise<boolean> {
    if (this.value.revision !== expectedRevision) return false;
    this.value = next;
    return true;
  }
}

class MemoryCheckpointStore implements HoidReviewerTrustCheckpointStore {
  value: HoidReviewerTrustCheckpoint = Object.freeze({ revision: 0, registryFingerprint: null });
  private readonly listeners = new Set<(checkpoint: unknown) => void>();
  async read(): Promise<unknown> { return this.value; }
  async compareAndSwap(expected: HoidReviewerTrustCheckpoint, next: HoidReviewerTrustCheckpoint): Promise<boolean> {
    if (
      this.value.revision !== expected.revision ||
      this.value.registryFingerprint !== expected.registryFingerprint
    ) return false;
    this.value = next;
    for (const listener of this.listeners) listener(this.value);
    return true;
  }
  subscribe(listener: (checkpoint: unknown) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

function setup() {
  const progressStore = new MemoryProgressStore();
  const coordinator = new HoidUnitProgressCoordinator(progressStore, () => now);
  const progressInvalidation = { subscribe: (_listener: () => void) => () => {} };
  const checkpointStore = new MemoryCheckpointStore();
  const packages: HoidSignedClaimPackageSource = Object.freeze({
    load: async () => Object.freeze([signedPackage()]),
    subscribe: (_listener: () => void) => () => {},
  });
  const registry: HoidReviewerTrustRegistrySource = Object.freeze({
    load: async () => signedRegistry(),
  });
  const transport = async (request: HoidExactClaimSelectionRequest) => Object.freeze({
    schemaVersion: request.schemaVersion,
    requestFingerprint: request.requestFingerprint,
    claimIds: Object.freeze(request.candidates.slice(0, 1).map(candidate => candidate.id)),
  });
  const compositionResult = createHoidTrustedConversationComposition(Object.freeze({
    coordinator,
    progressInvalidation,
    transport,
    packageSource: packages,
    registrySource: registry,
    checkpointStore,
    clock: Object.freeze({ nowIso: () => now }),
    context,
    rootKey,
    verifier: createHoidNobleEd25519VerificationPort(),
  }));
  if (compositionResult.status !== "composed") {
    throw new Error("Synthetic trusted composition failed: " + compositionResult.reason);
  }
  return { composition: compositionResult.composition, coordinator, progressStore };
}

describe("Hoid trusted conversation screen port", () => {
  it("accepts only a factory-created composition and brands the UI adapter", () => {
    const { composition } = setup();
    expect(isHoidTrustedConversationComposition(composition)).toBe(true);
    const port = createHoidTrustedConversationScreenPort(composition, "screen:primary");
    expect(isHoidTrustedConversationScreenPort(port)).toBe(true);
    expect(isHoidTrustedConversationScreenPort({ send: async () => null, dispose: () => {} })).toBe(false);
    port?.dispose();
    composition.dispose();
  });

  it("delivers only a v3-host-presented display projection with a matching progress permit", async () => {
    const { composition } = setup();
    const port = createHoidTrustedConversationScreenPort(composition, "screen:primary");
    expect(port).not.toBeNull();
    if (!port) return;

    const result = await port.send({
      question: "Explica Entidad Alfa.",
      intent: "explain",
      depth: "brief",
    });

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.presentation.text).toBe(core.text);
      expect(result.presentation.citations).toEqual([{
        sourceBookId: "twok",
        title: "El Camino de los Reyes",
        chapter: 2,
        chapterOrdinal: reference("twok", 2).ordinal,
        chapterLabelAmbiguous: false,
      }]);
      expect(result.progressRevision).toBe(1);
      expect(result.progressFingerprint).toMatch(/^[a-f0-9]{64}$/u);
      expect(result.context).toEqual({ claimCount: 1, entityCount: 1, workCount: 1 });
      expect(result.crossBookEvidence).toBeNull();
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain("evidence.exact-alpha");
      expect(serialized).not.toContain("identityFingerprint");
      expect(serialized).not.toContain("unitId");
    }
    port.dispose();
    expect(composition.activeSessionCount).toBe(0);
    composition.dispose();
  });

  it("keeps v3 follow-up context local and clears it after progress changes", async () => {
    const { composition, coordinator, progressStore } = setup();
    const port = createHoidTrustedConversationScreenPort(composition, "screen:follow-up");
    expect(port).not.toBeNull();
    if (!port) return;

    expect((await port.send({
      question: "¿Quién es Entidad Alfa?",
      intent: "explain",
      depth: "brief",
    })).status).toBe("ready");

    const followUp = await port.send({
      question: "¿Y qué relación tiene con ella?",
      intent: "explain",
      depth: "brief",
    });
    expect(followUp.status).toBe("ready");

    progressStore.value = snapshot(2, 2);
    await coordinator.refresh();
    const staleFollowUp = await port.send({
      question: "¿Y ella?",
      intent: "explain",
      depth: "brief",
    });
    expect(staleFollowUp).toEqual({
      status: "needs-clarification",
      reason: "missing-follow-up-context",
    });

    port.dispose();
    composition.dispose();
  });

  it("rejects malformed scope metadata before creating provider work", async () => {
    const { composition } = setup();
    const port = createHoidTrustedConversationScreenPort(composition, "screen:invalid-scope");
    expect(port).not.toBeNull();
    if (!port) return;
    const result = await port.send({
      question: "Explica Entidad Alfa.",
      intent: "explain",
      depth: "brief",
      bookScope: Object.freeze({
        mode: "single-work",
        bookIds: Object.freeze(["not-in-the-bibliography"]),
      }) as never,
    });
    expect(result).toEqual({ status: "blocked", reason: "invalid-request" });
    port.dispose();
    composition.dispose();
  });

  it("fails closed for an invalid composition or duplicate session", () => {
    expect(createHoidTrustedConversationScreenPort({}, "screen:invalid")).toBeNull();
    const { composition } = setup();
    const first = createHoidTrustedConversationScreenPort(composition, "screen:duplicate");
    expect(first).not.toBeNull();
    expect(createHoidTrustedConversationScreenPort(composition, "screen:duplicate")).toBeNull();
    first?.dispose();
    composition.dispose();
  });

  it("rejects sends after disposal and honors an already-aborted signal", async () => {
    const { composition } = setup();
    const port = createHoidTrustedConversationScreenPort(composition, "screen:cancel");
    expect(port).not.toBeNull();
    if (!port) return;
    const controller = new AbortController();
    controller.abort();
    const cancelled = await port.send({
      question: "Explica Entidad Alfa.",
      intent: "explain",
      depth: "brief",
    }, { signal: controller.signal });
    expect(cancelled.status).toBe("cancelled");
    port.dispose();
    expect(await port.send({
      question: "Explica Entidad Alfa.",
      intent: "explain",
      depth: "brief",
    })).toEqual({ status: "blocked", reason: "disposed" });
    composition.dispose();
  });
});
