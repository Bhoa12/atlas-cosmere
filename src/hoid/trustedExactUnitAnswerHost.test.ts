import { describe, expect, it } from "vitest";
import { ed25519 } from "@noble/curves/ed25519.js";
import {
  buildHoidReviewerTrustRegistrySigningMessage,
  type HoidReviewerTrustKey,
  type HoidReviewerTrustRegistryUnsigned,
} from "./editorialReviewSignatures";
import {
  createHoidTrustedExactUnitAnswerHost,
  type HoidReviewerTrustCheckpoint,
  type HoidReviewerTrustCheckpointStore,
  type HoidReviewerTrustRegistrySource,
  type HoidSignedClaimPackageSource,
  type HoidTrustedScreenAnswerPort,
} from "./trustedExactUnitAnswerHost";
import { buildHoidExactUnitClaimReviewSigningMessage, type HoidSignedExactUnitClaimPackage } from "./exactUnitClaimSignatures";
import { createHoidExactApprovedClaimAttestation, type HoidExactEvidenceRecord } from "./exactUnitClaimIntegrity";
import { createHoidChapterReference } from "./chapterReference";
import { createHoidUnitProgressCursor } from "./unitProgressCursor";
import { createHoidNobleEd25519VerificationPort } from "./nobleEd25519VerificationAdapter";
import { HoidUnitProgressCoordinator } from "./unitProgressCoordinator";
import { emptyHoidUnitProgressSnapshot, type HoidUnitProgressSnapshot, type HoidUnitProgressStore } from "./unitProgressLedger";
import type { HoidExactEvidenceAnswer } from "./exactUnitEvidenceRuntime";

const repository = "Bhoa12/atlas-cosmere";
const now = "2026-11-24T19:00:00.000Z";
const rootSeed = Uint8Array.from(Array.from({ length: 32 }, (_, index) => index + 1));
const reviewerSeed = Uint8Array.from(Array.from({ length: 32 }, (_, index) => index + 65));
const alternateReviewerSeed = Uint8Array.from(Array.from({ length: 32 }, (_, index) => index + 125));

function hex(value: Uint8Array): string {
  return Array.from(value, byte => byte.toString(16).padStart(2, "0")).join("");
}
function sign(message: string, seed: Uint8Array): string {
  return hex(ed25519.sign(new TextEncoder().encode(message), seed));
}
const rootKey = Object.freeze({ keyId: "root-2026", publicKeyHex: hex(ed25519.getPublicKey(rootSeed)) });
const reviewerKey: HoidReviewerTrustKey = Object.freeze({
  keyId: "reviewer-key-1", reviewerId: "reviewer-a", algorithm: "Ed25519",
  publicKeyHex: hex(ed25519.getPublicKey(reviewerSeed)), status: "active",
  validFrom: "2026-01-01T00:00:00.000Z", validUntil: "2027-01-01T00:00:00.000Z",
  revokedAt: null, allowedRepositoryFullNames: Object.freeze([repository]),
});
const context = Object.freeze({
  schemaVersion: 1 as const, repositoryFullName: repository, pullRequestNumber: 291,
  baseRef: "feat/hoid-ia-core-run290", baseSha: "ece8948c84b67fe3ff763f1bba952beedd09fc52",
  headRef: "feat/hoid-ia-core-run291", headSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  promotionManifestPath: "editorial/promotion-manifest.json",
  promotionPlanFingerprint: "b".repeat(64), reviewBundleFingerprint: "c".repeat(64),
});
function reference(bookId: string, chapterNumber: number) {
  const result = createHoidChapterReference(bookId, { chapterNumber });
  if (result.status !== "ready") throw new Error("Synthetic exact reference unavailable");
  return result.reference;
}
const evidence: readonly HoidExactEvidenceRecord[] = Object.freeze([Object.freeze({
  id: "evidence.exact-alpha", aliases: Object.freeze(["Entidad Alfa"]), kind: "character" as const,
  provenance: "verified" as const, summary: "Resumen editorial original y sintético para la prueba.",
})]);
const policy = Object.freeze({
  schemaVersion: 2 as const, evidenceId: "evidence.exact-alpha",
  source: reference("twok", 2), firstSafeAppearance: reference("twok", 2), unlock: reference("twok", 3),
});
const core = Object.freeze({
  id: "claim.exact-alpha", text: "Afirmación editorial sintética vinculada a unidades exactas.",
  intent: "explain" as const, evidenceIds: Object.freeze(["evidence.exact-alpha"]),
  entityIds: Object.freeze(["evidence.exact-alpha"]),
});
function signedPackage(text: string = core.text): HoidSignedExactUnitClaimPackage {
  const claimCore = Object.freeze({ ...core, text });
  const attestation = createHoidExactApprovedClaimAttestation(
    claimCore, evidence, [policy],
    Object.freeze({ reviewerId: "reviewer-a", reviewedAt: "2026-11-24T18:00:00.000Z" }),
  );
  if (attestation.status !== "valid") throw new Error("Synthetic exact claim attestation failed");
  const claim = Object.freeze({ ...claimCore, integrity: attestation.integrity, review: attestation.review });
  const unsigned = Object.freeze({ claim, evidence, policies: Object.freeze([policy]) });
  const message = buildHoidExactUnitClaimReviewSigningMessage(unsigned, context, reviewerKey.keyId);
  if (!message) throw new Error("Synthetic signing message invalid");
  return Object.freeze({
    ...unsigned,
    signature: Object.freeze({
      schemaVersion: 2 as const, algorithm: "Ed25519" as const, keyId: reviewerKey.keyId,
      signatureHex: sign(message, reviewerSeed),
    }),
  });
}
function createRegistry(revision: number, key: HoidReviewerTrustKey = reviewerKey) {
  const unsigned: HoidReviewerTrustRegistryUnsigned = Object.freeze({
    schemaVersion: 1, revision, issuedAt: "2026-11-24T18:00:00.000Z",
    expiresAt: "2026-12-01T00:00:00.000Z", keys: Object.freeze([key]),
  });
  const message = buildHoidReviewerTrustRegistrySigningMessage(unsigned);
  if (!message) throw new Error("Synthetic trust registry invalid");
  return Object.freeze({
    ...unsigned,
    rootSignature: Object.freeze({
      algorithm: "Ed25519" as const, keyId: rootKey.keyId, signatureHex: sign(message, rootSeed),
    }),
  });
}
const verifier = createHoidNobleEd25519VerificationPort();

class MemoryProgressStore implements HoidUnitProgressStore {
  value: HoidUnitProgressSnapshot = emptyHoidUnitProgressSnapshot();
  async read(): Promise<unknown> { return this.value; }
  async compareAndSwap(expectedRevision: number, next: HoidUnitProgressSnapshot): Promise<boolean> {
    if (this.value.revision !== expectedRevision) return false;
    this.value = next;
    return true;
  }
}
class MemoryTrustCheckpointStore implements HoidReviewerTrustCheckpointStore {
  value: HoidReviewerTrustCheckpoint = Object.freeze({ revision: 0, registryFingerprint: null });
  failWrites = false;
  async read(): Promise<unknown> { return this.value; }
  listeners = new Set<(checkpoint: unknown) => void>();
  emitChangedOnSubscribe: unknown = null;
  async compareAndSwap(expected: HoidReviewerTrustCheckpoint, next: HoidReviewerTrustCheckpoint): Promise<boolean> {
    if (this.failWrites || this.value.revision !== expected.revision ||
      this.value.registryFingerprint !== expected.registryFingerprint) return false;
    this.value = next;
    for (const listener of this.listeners) listener(this.value);
    return true;
  }
  publish(next: HoidReviewerTrustCheckpoint): void {
    this.value = next;
    for (const listener of this.listeners) listener(this.value);
  }
  subscribe(listener: (checkpoint: unknown) => void): () => void {
    this.listeners.add(listener);
    if (this.emitChangedOnSubscribe !== null) listener(this.emitChangedOnSubscribe);
    return () => this.listeners.delete(listener);
  }
}
function createProgressStore(): MemoryProgressStore {
  const store = new MemoryProgressStore();
  const cursor = createHoidUnitProgressCursor("twok", { chapterNumber: 4 });
  if (cursor.status !== "ready") throw new Error("Synthetic progress cursor unavailable");
  store.value = Object.freeze({
    schemaVersion: 3, revision: 1,
    positions: Object.freeze([Object.freeze({ bookId: "twok", cursor: cursor.cursor })]),
    updatedAt: now,
  });
  return store;
}
class MemoryProgressInvalidation {
  listeners = new Set<() => void>();
  emitOnSubscribe = false;
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    if (this.emitOnSubscribe) listener();
    return () => this.listeners.delete(listener);
  }
  emit(): void { for (const listener of this.listeners) listener(); }
}

function createHostHarness() {
  const progressStore = createProgressStore();
  const coordinator = new HoidUnitProgressCoordinator(progressStore);
  const checkpointStore = new MemoryTrustCheckpointStore();
  const progressInvalidation = new MemoryProgressInvalidation();
  let currentRegistry: unknown = createRegistry(3);
  let currentPackages: unknown = Object.freeze([signedPackage()]);
  const registrySource: HoidReviewerTrustRegistrySource = { async load() { return currentRegistry; } };
  const packageListeners = new Set<() => void>();
  const packageSource: HoidSignedClaimPackageSource & { emitOnSubscribe: boolean } = {
    emitOnSubscribe: false,
    async load() { return currentPackages; },
    subscribe(listener) {
      packageListeners.add(listener);
      if (this.emitOnSubscribe) listener();
      return () => packageListeners.delete(listener);
    },
  };
  const selectionRequests: unknown[] = [];
  let onSelect: (() => void) | null = null;
  let selectionBarrier: Readonly<{ started: () => void; wait: Promise<void> }> | null = null;
  const selector = {
    async selectClaims(request: {
      schemaVersion: 2 | 3;
      requestFingerprint: string;
      candidates: readonly { id: string }[];
    }) {
      selectionRequests.push(request);
      const barrier = selectionBarrier;
      selectionBarrier = null;
      if (barrier) {
        barrier.started();
        await barrier.wait;
      }
      const callback = onSelect;
      onSelect = null;
      callback?.();
      return Object.freeze({
        schemaVersion: request.schemaVersion, requestFingerprint: request.requestFingerprint,
        claimIds: Object.freeze(request.candidates.slice(0, 1).map(candidate => candidate.id)),
      });
    },
  };
  const host = createHoidTrustedExactUnitAnswerHost({
    coordinator, packageSource, registrySource, checkpointStore, progressInvalidation,
    clock: { nowIso: () => now }, context, rootKey, verifier, selector,
    maxRegistryAgeMs: 7 * 24 * 60 * 60 * 1000,
  });
  if (!host) throw new Error("Trusted host configuration rejected");
  return {
    host, progressStore, checkpointStore, progressInvalidation,
    setRegistry(value: unknown) { currentRegistry = value; },
    setPackages(value: unknown) {
      currentPackages = value;
      for (const listener of packageListeners) listener();
    },
    packageSource,
    selectionRequests,
    emitDuringSelection(callback: () => void) { onSelect = callback; },
    holdNextSelection() {
      let markStarted: () => void = () => {};
      let release: () => void = () => {};
      const started = new Promise<void>(resolve => { markStarted = resolve; });
      const wait = new Promise<void>(resolve => { release = resolve; });
      selectionBarrier = Object.freeze({ started: markStarted, wait });
      return Object.freeze({ started, release: () => release() });
    },
  };
}
function createSink() {
  const state: { answer?: HoidExactEvidenceAnswer; permit?: unknown; cleared?: string } = {};
  const sink: HoidTrustedScreenAnswerPort = {
    present(answer, permit) { state.answer = answer; state.permit = permit; },
    clear(reason) { state.cleared = reason; delete state.answer; delete state.permit; },
  };
  return { sink, state };
}
async function prepare(harness: ReturnType<typeof createHostHarness>) {
  const result = await harness.host.prepare({ question: "Explica Entidad Alfa", intent: "explain", depth: "brief" });
  if (result.status !== "prepared") throw new Error("Synthetic answer could not be prepared");
  return result.prepared;
}

describe("Hoid trusted exact-unit answer host", () => {
  it("keeps answer text out of the prepared token and presents only after trust/progress revalidation", async () => {
    const harness = createHostHarness();
    const prepared = await prepare(harness);
    expect(Object.keys(prepared)).not.toContain("answer");
    expect(JSON.stringify(prepared)).not.toContain("Afirmación editorial sintética");
    const { sink, state } = createSink();
    const result = await harness.host.present(prepared, sink);
    expect(result.status).toBe("presented");
    expect(state.answer?.text).toBe(core.text);
    expect(state.permit).toMatchObject({ registryRevision: 3, progressRevision: 1 });
    expect(harness.checkpointStore.value.revision).toBe(3);
  });

  it("rejects a prepared answer when progress regresses before presentation", async () => {
    const harness = createHostHarness();
    const prepared = await prepare(harness);
    const cursor = createHoidUnitProgressCursor("twok", { chapterNumber: 2 });
    if (cursor.status !== "ready") throw new Error("Synthetic regression cursor unavailable");
    harness.progressStore.value = Object.freeze({
      schemaVersion: 3, revision: 2,
      positions: Object.freeze([Object.freeze({ bookId: "twok", cursor: cursor.cursor })]),
      updatedAt: now,
    });
    const { sink, state } = createSink();
    const result = await harness.host.present(prepared, sink);
    expect(result).toEqual({ status: "blocked", reason: "progress-changed" });
    expect(state.answer).toBeUndefined();
    expect(state.cleared).toBe("progress-changed");
  });

  it("rejects a reviewer key revoked after answer preparation", async () => {
    const harness = createHostHarness();
    const prepared = await prepare(harness);
    const revoked: HoidReviewerTrustKey = Object.freeze({
      ...reviewerKey, status: "revoked", revokedAt: "2026-11-24T18:30:00.000Z",
    });
    harness.setRegistry(createRegistry(4, revoked));
    const { sink, state } = createSink();
    const result = await harness.host.present(prepared, sink);
    expect(result).toEqual({ status: "blocked", reason: "signature-invalid" });
    expect(state.answer).toBeUndefined();
    expect(state.cleared).toBe("signature-invalid");
  });

  it("rejects a lower trust-registry revision", async () => {
    const harness = createHostHarness();
    const prepared = await prepare(harness);
    harness.setRegistry(createRegistry(2));
    const { sink, state } = createSink();
    const result = await harness.host.present(prepared, sink);
    expect(result).toEqual({ status: "blocked", reason: "registry-rollback" });
    expect(state.answer).toBeUndefined();
  });

  it("detects same-revision registry equivocation", async () => {
    const harness = createHostHarness();
    const prepared = await prepare(harness);
    const alternate: HoidReviewerTrustKey = Object.freeze({
      ...reviewerKey, keyId: "reviewer-key-2",
      publicKeyHex: hex(ed25519.getPublicKey(alternateReviewerSeed)),
    });
    harness.setRegistry(createRegistry(3, alternate));
    const { sink, state } = createSink();
    const result = await harness.host.present(prepared, sink);
    expect(result).toEqual({ status: "blocked", reason: "registry-equivocation" });
    expect(state.answer).toBeUndefined();
  });

  it("rejects a different but newly signed claim bundle between preparation and presentation", async () => {
    const harness = createHostHarness();
    const prepared = await prepare(harness);
    harness.setPackages(Object.freeze([signedPackage("Afirmación editorial distinta y también firmada.")]));
    const { sink, state } = createSink();
    const result = await harness.host.present(prepared, sink);
    expect(result).toEqual({ status: "blocked", reason: "claim-bundle-changed" });
    expect(state.answer).toBeUndefined();
  });

  it("fails closed when the durable trust checkpoint cannot be advanced", async () => {
    const harness = createHostHarness();
    harness.checkpointStore.failWrites = true;
    const result = await harness.host.prepare({ question: "Explica Entidad Alfa", intent: "explain", depth: "brief" });
    expect(result).toEqual({ status: "blocked", reason: "trust-checkpoint-conflict" });
  });

  it("rejects stale registries even when their signatures and expiry are otherwise valid", async () => {
    const harness = createHostHarness();
    const unsigned: HoidReviewerTrustRegistryUnsigned = Object.freeze({
      schemaVersion: 1, revision: 3, issuedAt: "2026-11-01T00:00:00.000Z",
      expiresAt: "2026-12-01T00:00:00.000Z", keys: Object.freeze([reviewerKey]),
    });
    const message = buildHoidReviewerTrustRegistrySigningMessage(unsigned);
    if (!message) throw new Error("Synthetic stale registry invalid");
    harness.setRegistry(Object.freeze({
      ...unsigned,
      rootSignature: Object.freeze({
        algorithm: "Ed25519" as const, keyId: rootKey.keyId, signatureHex: sign(message, rootSeed),
      }),
    }));
    const result = await harness.host.prepare({ question: "Explica Entidad Alfa", intent: "explain", depth: "brief" });
    expect(result).toEqual({ status: "blocked", reason: "registry-stale" });
  });

  it("blocks if a durable cross-instance progress invalidation arrives during the presentation barrier", async () => {
    const harness = createHostHarness();
    const prepared = await prepare(harness);
    harness.progressInvalidation.emitOnSubscribe = true;
    const { sink, state } = createSink();
    const result = await harness.host.present(prepared, sink);
    expect(result).toEqual({ status: "blocked", reason: "progress-changed" });
    expect(state.answer).toBeUndefined();
    expect(state.cleared).toBe("progress-changed");
  });

  it("blocks if the durable trust checkpoint changes during the presentation barrier", async () => {
    const harness = createHostHarness();
    const prepared = await prepare(harness);
    harness.checkpointStore.emitChangedOnSubscribe = Object.freeze({
      revision: 4,
      registryFingerprint: "d".repeat(64),
    });
    const { sink, state } = createSink();
    const result = await harness.host.present(prepared, sink);
    expect(result).toEqual({ status: "blocked", reason: "trust-checkpoint-conflict" });
    expect(state.answer).toBeUndefined();
    expect(state.cleared).toBe("trust-checkpoint-conflict");
  });

  it("blocks if the verified editorial package source invalidates during presentation", async () => {
    const harness = createHostHarness();
    const prepared = await prepare(harness);
    harness.packageSource.emitOnSubscribe = true;
    const { sink, state } = createSink();
    const result = await harness.host.present(prepared, sink);
    expect(result).toEqual({ status: "blocked", reason: "claim-bundle-changed" });
    expect(state.answer).toBeUndefined();
    expect(state.cleared).toBe("claim-bundle-changed");
  });

  it("keeps invalidation subscriptions alive and retracts a displayed answer after progress changes", async () => {
    const harness = createHostHarness();
    const prepared = await prepare(harness);
    const { sink, state } = createSink();
    const result = await harness.host.present(prepared, sink);
    expect(result.status).toBe("presented");
    expect(state.answer).toBeDefined();
    harness.progressInvalidation.emit();
    expect(state.answer).toBeUndefined();
    expect(state.cleared).toBe("progress-changed");
  });

  it("retracts an already displayed answer when the trust checkpoint advances", async () => {
    const harness = createHostHarness();
    const prepared = await prepare(harness);
    const { sink, state } = createSink();
    const result = await harness.host.present(prepared, sink);
    expect(result.status).toBe("presented");
    harness.checkpointStore.publish({ revision: 4, registryFingerprint: "e".repeat(64) });
    expect(state.answer).toBeUndefined();
    expect(state.cleared).toBe("trust-checkpoint-conflict");
  });

  it("retracts an already displayed answer when the signed editorial bundle changes", async () => {
    const harness = createHostHarness();
    const prepared = await prepare(harness);
    const { sink, state } = createSink();
    const result = await harness.host.present(prepared, sink);
    expect(result.status).toBe("presented");
    harness.setPackages(Object.freeze([signedPackage("Afirmación editorial renovada y firmada.")]));
    expect(state.answer).toBeUndefined();
    expect(state.cleared).toBe("claim-bundle-changed");
  });

  it("keeps multiple verified conversation messages active and retracts all on progress invalidation", async () => {
    const harness = createHostHarness();
    const firstPrepared = await prepare(harness);
    const secondPrepared = await prepare(harness);
    const first = createSink();
    const second = createSink();
    expect((await harness.host.present(firstPrepared, first.sink)).status).toBe("presented");
    expect((await harness.host.present(secondPrepared, second.sink)).status).toBe("presented");
    expect(first.state.answer?.text).toBe(core.text);
    expect(second.state.answer?.text).toBe(core.text);
    harness.progressInvalidation.emit();
    expect(first.state.answer).toBeUndefined();
    expect(second.state.answer).toBeUndefined();
    expect(first.state.cleared).toBe("progress-changed");
    expect(second.state.cleared).toBe("progress-changed");
  });

  it("can retract one conversation message without clearing another session", async () => {
    const harness = createHostHarness();
    const firstPrepared = await prepare(harness);
    const secondPrepared = await prepare(harness);
    const first = createSink();
    const second = createSink();
    expect((await harness.host.present(firstPrepared, first.sink)).status).toBe("presented");
    expect((await harness.host.present(secondPrepared, second.sink)).status).toBe("presented");
    harness.host.clearSink(first.sink, "invalid-host");
    expect(first.state.answer).toBeUndefined();
    expect(first.state.cleared).toBe("invalid-host");
    expect(second.state.answer?.text).toBe(core.text);
    harness.host.clear();
    expect(second.state.answer).toBeUndefined();
  });

  it("mints an opaque continuation only after presentation and carries chapter scope privately", async () => {
    const harness = createHostHarness();
    const prepared = await prepare(harness);
    expect(harness.host.getFollowUpCapability(prepared)).toBeNull();

    const first = createSink();
    expect((await harness.host.present(prepared, first.sink)).status).toBe("presented");
    const capability = harness.host.getFollowUpCapability(prepared);
    expect(capability).not.toBeNull();
    expect(JSON.stringify(capability)).not.toContain("twok");
    expect(JSON.stringify(capability)).not.toContain("identityFingerprint");
    expect(JSON.stringify(capability)).not.toContain("chapterScope");

    const followUp = await harness.host.prepareFollowUp({
      question: "¿Puedes ampliar la explicación?",
      intent: "explain",
      depth: "brief",
    }, capability);
    if (followUp.status !== "prepared") throw new Error("Follow-up blocked: " + JSON.stringify(followUp));
    const providerRequest = harness.selectionRequests[harness.selectionRequests.length - 1] as Record<string, unknown>;
    expect(providerRequest).toHaveProperty("conversationContext");
    expect(providerRequest).not.toHaveProperty("chapterScope");
    expect(JSON.stringify(providerRequest)).not.toContain("identityFingerprint");
    expect(JSON.stringify(providerRequest)).not.toContain("locatorId");

    if (followUp.status !== "prepared") throw new Error("Expected follow-up preparation");
    const second = createSink();
    expect((await harness.host.present(followUp.prepared, second.sink)).status).toBe("presented");
    const nextCapability = harness.host.getFollowUpCapability(followUp.prepared);
    expect(nextCapability).not.toBeNull();
    expect(nextCapability).not.toBe(capability);
  });

  it("allows only one in-flight provider selection per follow-up capability", async () => {
    const harness = createHostHarness();
    const parentPrepared = await prepare(harness);
    const parentSink = createSink();
    expect((await harness.host.present(parentPrepared, parentSink.sink)).status).toBe("presented");
    const capability = harness.host.getFollowUpCapability(parentPrepared);
    expect(capability).not.toBeNull();

    const barrier = harness.holdNextSelection();
    const firstPromise = harness.host.prepareFollowUp({
      question: "¿Puedes ampliar la explicación?",
    }, capability);
    await barrier.started;

    const selectionsAfterFirstStarted = harness.selectionRequests.length;
    const concurrent = await harness.host.prepareFollowUp({
      question: "¿Puedes comparar esa explicación?",
      intent: "context",
    }, capability);
    expect(concurrent).toEqual({
      status: "blocked",
      reason: "follow-up-in-progress",
    });
    expect(harness.selectionRequests).toHaveLength(selectionsAfterFirstStarted);

    barrier.release();
    const first = await firstPromise;
    expect(first.status).toBe("prepared");

    // The lock is single-flight, not single-use: a later sequential request
    // may branch from the still-active parent presentation.
    const sequential = await harness.host.prepareFollowUp({
      question: "¿Puedes resumirlo?",
      intent: "explain",
    }, capability);
    expect(sequential.status).toBe("prepared");
  });

  it("rejects caller-supplied chapter or entity scopes instead of accepting arbitrary context", async () => {
    const harness = createHostHarness();
    const prepared = await prepare(harness);
    const sink = createSink();
    expect((await harness.host.present(prepared, sink.sink)).status).toBe("presented");
    const capability = harness.host.getFollowUpCapability(prepared);
    expect(capability).not.toBeNull();

    const result = await harness.host.prepareFollowUp({
      question: "¿Y esto cómo funciona?",
      chapterScope: [reference("twok", 4)],
      entityIds: ["caller.supplied"],
    }, capability);
    expect(result).toEqual({
      status: "blocked",
      reason: "answer-unavailable",
      runtimeReason: "invalid-request",
    });
  });

  it("revokes the continuation capability when its presented message is cleared", async () => {
    const harness = createHostHarness();
    const prepared = await prepare(harness);
    const sink = createSink();
    expect((await harness.host.present(prepared, sink.sink)).status).toBe("presented");
    const capability = harness.host.getFollowUpCapability(prepared);
    expect(capability).not.toBeNull();

    harness.host.clearSink(sink.sink, "context-reset");
    expect(harness.host.getFollowUpCapability(prepared)).toBeNull();
    expect(sink.state.answer).toBeUndefined();
    expect(await harness.host.prepareFollowUp({ question: "¿Puedes aclararlo?" }, capability)).toEqual({
      status: "blocked",
      reason: "invalid-follow-up-capability",
    });
  });

  it("revokes the continuation when durable progress changes without a notification", async () => {
    const harness = createHostHarness();
    const prepared = await prepare(harness);
    const sink = createSink();
    expect((await harness.host.present(prepared, sink.sink)).status).toBe("presented");
    const capability = harness.host.getFollowUpCapability(prepared);
    expect(capability).not.toBeNull();

    const regressed = createHoidUnitProgressCursor("twok", { chapterNumber: 3 });
    if (regressed.status !== "ready") throw new Error("Synthetic progress cursor unavailable");
    harness.progressStore.value = Object.freeze({
      schemaVersion: 3,
      revision: 2,
      positions: Object.freeze([Object.freeze({ bookId: "twok", cursor: regressed.cursor })]),
      updatedAt: now,
    });

    const result = await harness.host.prepareFollowUp({ question: "¿Puedes aclararlo?" }, capability);
    expect(result).toEqual({ status: "blocked", reason: "progress-changed" });
    expect(harness.host.getFollowUpCapability(prepared)).toBeNull();
    expect(sink.state.answer).toBeUndefined();
    expect(sink.state.cleared).toBe("progress-changed");
  });

  it("discards an in-flight follow-up if progress invalidates its parent presentation", async () => {
    const harness = createHostHarness();
    const prepared = await prepare(harness);
    const sink = createSink();
    expect((await harness.host.present(prepared, sink.sink)).status).toBe("presented");
    const capability = harness.host.getFollowUpCapability(prepared);
    expect(capability).not.toBeNull();

    harness.emitDuringSelection(() => harness.progressInvalidation.emit());
    const result = await harness.host.prepareFollowUp({
      question: "¿Puedes ampliar la explicación?",
    }, capability);

    expect(result).toEqual({
      status: "blocked",
      reason: "invalid-follow-up-capability",
    });
    expect(harness.host.getFollowUpCapability(prepared)).toBeNull();
    expect(sink.state.answer).toBeUndefined();
    expect(sink.state.cleared).toBe("progress-changed");
  });

  it("blocks a prepared child if its parent is cleared before the child is presented", async () => {
    const harness = createHostHarness();
    const parentPrepared = await prepare(harness);
    const parentSink = createSink();
    expect((await harness.host.present(parentPrepared, parentSink.sink)).status).toBe("presented");
    const parentCapability = harness.host.getFollowUpCapability(parentPrepared);
    expect(parentCapability).not.toBeNull();

    const childPrepared = await harness.host.prepareFollowUp({
      question: "¿Puedes desarrollar esa idea?",
    }, parentCapability);
    expect(childPrepared.status).toBe("prepared");
    if (childPrepared.status !== "prepared") return;

    harness.host.clearSink(parentSink.sink, "context-reset");
    const childSink = createSink();
    expect(await harness.host.present(childPrepared.prepared, childSink.sink)).toEqual({
      status: "blocked",
      reason: "invalid-follow-up-capability",
    });
    expect(childSink.state.answer).toBeUndefined();
  });

  it("recursively retracts presented descendants when an ancestor message is cleared", async () => {
    const harness = createHostHarness();
    const parentPrepared = await prepare(harness);
    const parentSink = createSink();
    expect((await harness.host.present(parentPrepared, parentSink.sink)).status).toBe("presented");
    const parentCapability = harness.host.getFollowUpCapability(parentPrepared);
    expect(parentCapability).not.toBeNull();

    const childPrepared = await harness.host.prepareFollowUp({
      question: "¿Puedes desarrollar esa idea?",
    }, parentCapability);
    expect(childPrepared.status).toBe("prepared");
    if (childPrepared.status !== "prepared") return;
    const childSink = createSink();
    expect((await harness.host.present(childPrepared.prepared, childSink.sink)).status).toBe("presented");
    expect(harness.host.getFollowUpCapability(childPrepared.prepared)).not.toBeNull();

    harness.host.clearSink(parentSink.sink, "context-reset");
    expect(parentSink.state.answer).toBeUndefined();
    expect(childSink.state.answer).toBeUndefined();
    expect(childSink.state.cleared).toBe("context-reset");
    expect(harness.host.getFollowUpCapability(childPrepared.prepared)).toBeNull();
  });

});
