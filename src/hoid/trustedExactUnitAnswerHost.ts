import {
  buildHoidReviewerTrustRegistrySigningMessage,
  type HoidApprovedClaimReviewSignatureContext,
  type HoidEd25519VerificationPort,
  type HoidReviewerTrustRegistry,
  type HoidReviewerTrustRootKey,
} from "./editorialReviewSignatures";
import {
  createHoidSignedExactUnitEvidenceRuntime,
  type HoidSignedExactUnitClaimPackage,
} from "./exactUnitClaimSignatures";
import {
  type HoidExactClaimSelector,
  type HoidExactEvidenceAnswer,
  type HoidExactEvidenceRuntimeResult,
  type HoidExactPresentationReceipt,
  type HoidExactPresentationVerification,
  type HoidExactUnitEvidenceRuntime,
  type HoidExactRuntimeCallOptions,
} from "./exactUnitEvidenceRuntime";
import { HoidUnitProgressCoordinator } from "./unitProgressCoordinator";
import { sha256Hex } from "./sha256";

export type HoidReviewerTrustCheckpoint = Readonly<{
  revision: number;
  registryFingerprint: string | null;
}>;

/** Durable atomic anti-rollback checkpoint; not AsyncStorage or UI state. */
export interface HoidReviewerTrustCheckpointStore {
  read(): Promise<unknown>;
  compareAndSwap(expected: HoidReviewerTrustCheckpoint, next: HoidReviewerTrustCheckpoint): Promise<boolean>;
  /** Broadcast every committed checkpoint change across all host instances. */
  subscribe(listener: (checkpoint: unknown) => void): () => void;
}
export interface HoidReviewerTrustRegistrySource { load(): Promise<unknown>; }
export interface HoidSignedClaimPackageSource {
  load(): Promise<unknown>;
  /** Broadcast replacement or invalidation of the verified editorial bundle. */
  subscribe(listener: () => void): () => void;
}
export interface HoidTrustedClock { nowIso(): string; }
/** Must broadcast durable progress commits from every coordinator/process sharing the ledger. */
export interface HoidTrustedProgressInvalidationPort {
  subscribe(listener: () => void): () => void;
}

export type HoidTrustedPresentationPermit = Readonly<{
  registryRevision: number;
  registryFingerprint: string;
  progressRevision: number;
  progressFingerprint: string;
}>;

/** Synchronous UI sink invoked only after trust and exact-progress revalidation. */
export interface HoidTrustedScreenAnswerPort {
  present(answer: HoidExactEvidenceAnswer, permit: HoidTrustedPresentationPermit): void;
  clear(reason: HoidTrustedAnswerBlockReason): void;
}

export type HoidTrustedAnswerBlockReason =
  | "invalid-host" | "invalid-prepared-answer" | "trust-source-unavailable"
  | "trust-checkpoint-unavailable" | "trust-checkpoint-invalid" | "registry-invalid"
  | "registry-stale" | "registry-rollback" | "registry-equivocation"
  | "trust-checkpoint-conflict" | "signature-invalid" | "claim-bundle-changed"
  | "progress-unavailable" | "progress-changed" | "evidence-locked"
  | "answer-unavailable" | "presentation-sink-failed";

export type HoidPreparedExactUnitAnswer = Readonly<{
  kind: "hoid-prepared-exact-unit-answer";
  registryRevision: number;
  progressRevision: number;
}>;

export type HoidTrustedAnswerPrepareResult =
  | Readonly<{ status: "prepared"; prepared: HoidPreparedExactUnitAnswer }>
  | Readonly<{
      status: "blocked";
      reason: HoidTrustedAnswerBlockReason;
      runtimeReason?: Extract<HoidExactEvidenceRuntimeResult, { status: "unavailable" }>["reason"];
    }>;

export type HoidTrustedAnswerPresentationResult =
  | Readonly<{ status: "presented"; registryRevision: number; progressRevision: number }>
  | Readonly<{ status: "blocked"; reason: HoidTrustedAnswerBlockReason }>;

type HostConfig = Readonly<{
  coordinator: HoidUnitProgressCoordinator;
  packageSource: HoidSignedClaimPackageSource;
  registrySource: HoidReviewerTrustRegistrySource;
  checkpointStore: HoidReviewerTrustCheckpointStore;
  progressInvalidation: HoidTrustedProgressInvalidationPort;
  clock: HoidTrustedClock;
  context: HoidApprovedClaimReviewSignatureContext;
  rootKey: HoidReviewerTrustRootKey;
  verifier: HoidEd25519VerificationPort;
  selector: HoidExactClaimSelector;
  providerTimeoutMs: number;
  maxRegistryAgeMs: number;
}>;
type TrustedRuntime = Readonly<{
  runtime: HoidExactUnitEvidenceRuntime;
  registryRevision: number;
  registryFingerprint: string;
  contextFingerprint: string;
  packageFingerprint: string;
}>;
type PendingAnswer = Readonly<{
  runtime: HoidExactUnitEvidenceRuntime;
  answer: HoidExactEvidenceAnswer;
  receipt: HoidExactPresentationReceipt;
  contextFingerprint: string;
  packageFingerprint: string;
}>;
type ActivePresentation = Readonly<{
  token: object;
  sink: HoidTrustedScreenAnswerPort;
  unsubscribers: readonly (() => void)[];
}>;

const CHECKPOINT_KEYS = ["revision", "registryFingerprint"] as const;
const REGISTRY_KEYS = ["schemaVersion", "revision", "issuedAt", "expiresAt", "keys", "rootSignature"] as const;
const DEFAULT_MAX_REGISTRY_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_REGISTRY_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ACTIVE_PRESENTATIONS = 64;
const SHA_PATTERN = /^[a-f0-9]{64}$/u;

function exactRecord(value: unknown, allowed: readonly string[], required: readonly string[] = allowed): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.some(key => typeof key !== "string" || !allowed.includes(key))) return null;
    const output = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string") return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) return null;
      output[key] = descriptor.value;
    }
    if (required.some(key => !Object.prototype.hasOwnProperty.call(output, key))) return null;
    return output;
  } catch { return null; }
}

function callableMethod(value: unknown, name: string): ((...args: never[]) => unknown) | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    let current: object | null = value;
    for (let depth = 0; current && current !== Object.prototype && depth < 6; depth += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(current, name);
      if (descriptor) {
        if (!Object.prototype.hasOwnProperty.call(descriptor, "value") || typeof descriptor.value !== "function") return null;
        return (descriptor.value as (...args: never[]) => unknown).bind(value);
      }
      current = Object.getPrototypeOf(current) as object | null;
    }
    return null;
  } catch { return null; }
}

function canonicalIso(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  try { return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value; }
  catch { return false; }
}

function canonicalCheckpoint(value: unknown): HoidReviewerTrustCheckpoint | null {
  const record = exactRecord(value, CHECKPOINT_KEYS);
  if (!record || !Number.isSafeInteger(record.revision) || (record.revision as number) < 0 ||
    !((record.revision === 0 && record.registryFingerprint === null) ||
      ((record.revision as number) > 0 && typeof record.registryFingerprint === "string" && SHA_PATTERN.test(record.registryFingerprint)))) return null;
  return Object.freeze({ revision: record.revision as number, registryFingerprint: record.registryFingerprint as string | null });
}

function registryHeader(value: unknown): Readonly<{ revision: number; issuedAt: string }> | null {
  const record = exactRecord(value, REGISTRY_KEYS);
  if (!record || record.schemaVersion !== 1 || !Number.isSafeInteger(record.revision) ||
    (record.revision as number) < 1 || !canonicalIso(record.issuedAt)) return null;
  return Object.freeze({ revision: record.revision as number, issuedAt: record.issuedAt });
}

function registryUnsignedPayload(
  value: unknown,
): Parameters<typeof buildHoidReviewerTrustRegistrySigningMessage>[0] | null {
  const record = exactRecord(value, REGISTRY_KEYS);
  if (!record || record.schemaVersion !== 1 ||
    !Number.isSafeInteger(record.revision) || (record.revision as number) < 1 ||
    !canonicalIso(record.issuedAt) || !canonicalIso(record.expiresAt) ||
    !Array.isArray(record.keys)) return null;
  return Object.freeze({
    schemaVersion: 1,
    revision: record.revision as number,
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
    keys: record.keys,
  }) as Parameters<typeof buildHoidReviewerTrustRegistrySigningMessage>[0];
}

function sameCheckpoint(left: HoidReviewerTrustCheckpoint, right: HoidReviewerTrustCheckpoint): boolean {
  return left.revision === right.revision && left.registryFingerprint === right.registryFingerprint;
}
function trustedSink(value: unknown): value is HoidTrustedScreenAnswerPort {
  return callableMethod(value, "present") !== null && callableMethod(value, "clear") !== null;
}
function mapPresentationFailure(result: HoidExactPresentationVerification): HoidTrustedAnswerBlockReason {
  if (result.status === "ready") return "presentation-sink-failed";
  switch (result.reason) {
    case "progress-changed": return "progress-changed";
    case "progress-unavailable": return "progress-unavailable";
    case "evidence-locked": return "evidence-locked";
    default: return "invalid-prepared-answer";
  }
}

/**
 * Provider-neutral host composition. The model only selects IDs from approved
 * candidates; it never receives trust state, progress, unit IDs or EPUB locators.
 */
export class HoidTrustedExactUnitAnswerHost {
  private readonly pending = new WeakMap<object, PendingAnswer>();
  private readonly activePresentations = new Map<object, ActivePresentation>();
  private constructor(private readonly config: HostConfig) {}

  private clearPresentation(token: object, reason: HoidTrustedAnswerBlockReason): void {
    const active = this.activePresentations.get(token);
    if (!active) return;
    this.activePresentations.delete(token);
    for (const unsubscribe of active.unsubscribers) {
      try { unsubscribe(); } catch { /* continue clearing remaining ports */ }
    }
    try { active.sink.clear(reason); } catch { /* fail closed */ }
  }

  private clearActivePresentation(reason: HoidTrustedAnswerBlockReason): void {
    for (const token of [...this.activePresentations.keys()]) this.clearPresentation(token, reason);
  }

  /** Retract every answer owned by this host and release its subscriptions. */
  clear(reason: HoidTrustedAnswerBlockReason = "invalid-prepared-answer"): void {
    this.clearActivePresentation(reason);
  }

  /** Retract one message without disturbing other turns or sessions. */
  clearSink(sink: HoidTrustedScreenAnswerPort, reason: HoidTrustedAnswerBlockReason = "invalid-prepared-answer"): void {
    for (const [token, active] of [...this.activePresentations.entries()]) {
      if (active.sink === sink) this.clearPresentation(token, reason);
    }
  }

  dispose(): void {
    this.clearActivePresentation("invalid-host");
  }

  static create(configInput: unknown): HoidTrustedExactUnitAnswerHost | null {
    const record = exactRecord(configInput, [
      "coordinator", "packageSource", "registrySource", "checkpointStore", "progressInvalidation", "clock",
      "context", "rootKey", "verifier", "selector", "providerTimeoutMs", "maxRegistryAgeMs",
    ], [
      "coordinator", "packageSource", "registrySource", "checkpointStore", "clock",
      "context", "rootKey", "verifier", "selector",
    ]);
    if (!record || !(record.coordinator instanceof HoidUnitProgressCoordinator) ||
      !callableMethod(record.packageSource, "load") || !callableMethod(record.packageSource, "subscribe") ||
      !callableMethod(record.registrySource, "load") ||
      !callableMethod(record.checkpointStore, "read") || !callableMethod(record.checkpointStore, "compareAndSwap") ||
      !callableMethod(record.checkpointStore, "subscribe") ||
      !callableMethod(record.progressInvalidation, "subscribe") ||
      !callableMethod(record.clock, "nowIso") || !callableMethod(record.verifier, "verify") ||
      !callableMethod(record.selector, "selectClaims") ||
      record.context === null || typeof record.context !== "object" ||
      record.rootKey === null || typeof record.rootKey !== "object") return null;

    const providerTimeoutMs = record.providerTimeoutMs === undefined ? 10_000 : record.providerTimeoutMs;
    const maxRegistryAgeMs = record.maxRegistryAgeMs === undefined ? DEFAULT_MAX_REGISTRY_AGE_MS : record.maxRegistryAgeMs;
    if (typeof providerTimeoutMs !== "number" || !Number.isSafeInteger(providerTimeoutMs) ||
      providerTimeoutMs < 1 || providerTimeoutMs > 60_000 ||
      typeof maxRegistryAgeMs !== "number" || !Number.isSafeInteger(maxRegistryAgeMs) ||
      maxRegistryAgeMs < 60_000 || maxRegistryAgeMs > MAX_REGISTRY_AGE_MS) return null;

    return new HoidTrustedExactUnitAnswerHost(Object.freeze({
      coordinator: record.coordinator,
      packageSource: record.packageSource as HoidSignedClaimPackageSource,
      registrySource: record.registrySource as HoidReviewerTrustRegistrySource,
      checkpointStore: record.checkpointStore as HoidReviewerTrustCheckpointStore,
      progressInvalidation: record.progressInvalidation as HoidTrustedProgressInvalidationPort,
      clock: record.clock as HoidTrustedClock,
      context: record.context as HoidApprovedClaimReviewSignatureContext,
      rootKey: record.rootKey as HoidReviewerTrustRootKey,
      verifier: record.verifier as HoidEd25519VerificationPort,
      selector: record.selector as HoidExactClaimSelector,
      providerTimeoutMs,
      maxRegistryAgeMs,
    }));
  }

  private async loadTrustedRuntime(selector: HoidExactClaimSelector | null): Promise<
    Readonly<{ status: "ready"; value: TrustedRuntime }> |
    Readonly<{ status: "blocked"; reason: HoidTrustedAnswerBlockReason }>
  > {
    let checkpoint: HoidReviewerTrustCheckpoint;
    let registry: unknown;
    let signedPackages: unknown;
    let now: string;
    try {
      const parsed = canonicalCheckpoint(await this.config.checkpointStore.read());
      if (!parsed) return Object.freeze({ status: "blocked", reason: "trust-checkpoint-invalid" });
      checkpoint = parsed;
      [registry, signedPackages] = await Promise.all([
        this.config.registrySource.load(), this.config.packageSource.load(),
      ]);
      now = this.config.clock.nowIso();
    } catch {
      return Object.freeze({ status: "blocked", reason: "trust-source-unavailable" });
    }

    const unsignedRegistry = registryUnsignedPayload(registry);
    const registryMessage = unsignedRegistry
      ? buildHoidReviewerTrustRegistrySigningMessage(unsignedRegistry)
      : null;
    const header = registryHeader(registry);
    if (!registryMessage || !header || !canonicalIso(now)) {
      return Object.freeze({ status: "blocked", reason: "registry-invalid" });
    }
    if (Date.parse(now) < Date.parse(header.issuedAt) ||
      Date.parse(now) - Date.parse(header.issuedAt) > this.config.maxRegistryAgeMs) {
      return Object.freeze({ status: "blocked", reason: "registry-stale" });
    }

    const registryFingerprint = sha256Hex(registryMessage);
    if (header.revision < checkpoint.revision) return Object.freeze({ status: "blocked", reason: "registry-rollback" });
    if (header.revision === checkpoint.revision && checkpoint.registryFingerprint !== registryFingerprint) {
      return Object.freeze({ status: "blocked", reason: "registry-equivocation" });
    }

    let build: Awaited<ReturnType<typeof createHoidSignedExactUnitEvidenceRuntime>>;
    try {
      build = await createHoidSignedExactUnitEvidenceRuntime({
        coordinator: this.config.coordinator,
        signedPackages: signedPackages as readonly HoidSignedExactUnitClaimPackage[],
        context: this.config.context,
        trustRegistry: registry as HoidReviewerTrustRegistry,
        rootKey: this.config.rootKey,
        verifier: this.config.verifier,
        now,
        minimumRegistryRevision: Math.max(1, checkpoint.revision),
        selector,
        providerTimeoutMs: this.config.providerTimeoutMs,
      });
    } catch {
      return Object.freeze({ status: "blocked", reason: "signature-invalid" });
    }
    if (build.status !== "ready" || build.registryRevision !== header.revision) {
      return Object.freeze({ status: "blocked", reason: "signature-invalid" });
    }
    let packageFingerprint: string;
    try {
      const canonicalPackagesJson = JSON.stringify(build.packages);
      if (typeof canonicalPackagesJson !== "string") {
        return Object.freeze({ status: "blocked", reason: "signature-invalid" });
      }
      packageFingerprint = sha256Hex(canonicalPackagesJson);
    } catch {
      return Object.freeze({ status: "blocked", reason: "signature-invalid" });
    }

    if (header.revision > checkpoint.revision) {
      const next: HoidReviewerTrustCheckpoint = Object.freeze({ revision: header.revision, registryFingerprint });
      let advanced = false;
      try { advanced = await this.config.checkpointStore.compareAndSwap(checkpoint, next); }
      catch { return Object.freeze({ status: "blocked", reason: "trust-checkpoint-unavailable" }); }
      if (!advanced) {
        let current: HoidReviewerTrustCheckpoint | null;
        try { current = canonicalCheckpoint(await this.config.checkpointStore.read()); }
        catch { return Object.freeze({ status: "blocked", reason: "trust-checkpoint-unavailable" }); }
        if (!current) return Object.freeze({ status: "blocked", reason: "trust-checkpoint-invalid" });
        if (!sameCheckpoint(current, next)) {
          if (current.revision > header.revision) return Object.freeze({ status: "blocked", reason: "registry-rollback" });
          if (current.revision === header.revision && current.registryFingerprint !== registryFingerprint) {
            return Object.freeze({ status: "blocked", reason: "registry-equivocation" });
          }
          return Object.freeze({ status: "blocked", reason: "trust-checkpoint-conflict" });
        }
      }
    }

    return Object.freeze({
      status: "ready",
      value: Object.freeze({
        runtime: build.runtime,
        registryRevision: build.registryRevision,
        registryFingerprint,
        contextFingerprint: build.contextFingerprint,
        packageFingerprint,
      }),
    });
  }

  async prepare(request: unknown, options: HoidExactRuntimeCallOptions = {}): Promise<HoidTrustedAnswerPrepareResult> {
    const trusted = await this.loadTrustedRuntime(this.config.selector);
    if (trusted.status !== "ready") return Object.freeze({ status: "blocked", reason: trusted.reason });
    const result = await trusted.value.runtime.answer(request, options);
    if (result.status !== "ready") {
      const reason: HoidTrustedAnswerBlockReason =
        result.reason === "progress-unavailable" ? "progress-unavailable" :
        result.reason === "progress-changed" ? "progress-changed" :
        result.reason === "evidence-locked" ? "evidence-locked" : "answer-unavailable";
      return Object.freeze({ status: "blocked", reason, runtimeReason: result.reason });
    }

    const receipt: HoidExactPresentationReceipt = Object.freeze({
      progressRevision: result.progressRevision,
      progressFingerprint: result.progressFingerprint,
      evidenceIds: Object.freeze([...result.answer.evidenceIds]),
    });
    const prepared: HoidPreparedExactUnitAnswer = Object.freeze({
      kind: "hoid-prepared-exact-unit-answer",
      registryRevision: trusted.value.registryRevision,
      progressRevision: result.progressRevision,
    });
    this.pending.set(prepared, Object.freeze({
      runtime: trusted.value.runtime,
      answer: result.answer,
      receipt,
      contextFingerprint: trusted.value.contextFingerprint,
      packageFingerprint: trusted.value.packageFingerprint,
    }));
    return Object.freeze({ status: "prepared", prepared });
  }

  cancel(prepared: HoidPreparedExactUnitAnswer): void {
    if (prepared !== null && typeof prepared === "object") this.pending.delete(prepared);
  }

  async present(
    preparedInput: HoidPreparedExactUnitAnswer,
    sinkInput: HoidTrustedScreenAnswerPort,
  ): Promise<HoidTrustedAnswerPresentationResult> {
    if (!trustedSink(sinkInput)) return Object.freeze({ status: "blocked", reason: "presentation-sink-failed" });
    const sink = sinkInput;
    const clear = (reason: HoidTrustedAnswerBlockReason) => {
      try { sink.clear(reason); } catch { /* fail closed */ }
    };
    if (preparedInput === null || typeof preparedInput !== "object") {
      clear("invalid-prepared-answer");
      return Object.freeze({ status: "blocked", reason: "invalid-prepared-answer" });
    }
    const pending = this.pending.get(preparedInput);
    this.pending.delete(preparedInput);
    if (!pending) {
      clear("invalid-prepared-answer");
      return Object.freeze({ status: "blocked", reason: "invalid-prepared-answer" });
    }

    const currentTrust = await this.loadTrustedRuntime(null);
    if (currentTrust.status !== "ready") {
      clear(currentTrust.reason);
      return Object.freeze({ status: "blocked", reason: currentTrust.reason });
    }
    if (currentTrust.value.contextFingerprint !== pending.contextFingerprint ||
      currentTrust.value.packageFingerprint !== pending.packageFingerprint) {
      clear("claim-bundle-changed");
      return Object.freeze({ status: "blocked", reason: "claim-bundle-changed" });
    }

    const expectedCheckpoint: HoidReviewerTrustCheckpoint = Object.freeze({
      revision: currentTrust.value.registryRevision,
      registryFingerprint: currentTrust.value.registryFingerprint,
    });
    let trustInvalidated = false;
    let progressInvalidated = false;
    let bundleInvalidated = false;
    let unsubscribeTrust = () => {};
    let unsubscribeProgress = () => {};
    let unsubscribeLocalProgress = () => {};
    let unsubscribeBundle = () => {};
    let handedOff = false;
    const presentationToken = Object.freeze({});
    const invalidateActive = (reason: HoidTrustedAnswerBlockReason) => {
      this.clearPresentation(presentationToken, reason);
    };
    try {
      unsubscribeTrust = this.config.checkpointStore.subscribe(value => {
        const checkpoint = canonicalCheckpoint(value);
        if (!checkpoint || !sameCheckpoint(checkpoint, expectedCheckpoint)) {
          trustInvalidated = true;
          invalidateActive("trust-checkpoint-conflict");
        }
      });
      unsubscribeProgress = this.config.progressInvalidation.subscribe(() => {
        progressInvalidated = true;
        invalidateActive("progress-changed");
      });
      unsubscribeBundle = this.config.packageSource.subscribe(() => {
        bundleInvalidated = true;
        invalidateActive("claim-bundle-changed");
      });
      unsubscribeLocalProgress = this.config.coordinator.subscribe(() => {
        progressInvalidated = true;
        invalidateActive("progress-changed");
      });

      // Re-read the complete trust/bundle snapshot after subscriptions are installed.
      // This closes the publication-to-subscription race for package and registry sources.
      const recheckedTrust = await this.loadTrustedRuntime(null);
      if (recheckedTrust.status !== "ready") {
        clear(recheckedTrust.reason);
        return Object.freeze({ status: "blocked", reason: recheckedTrust.reason });
      }
      if (recheckedTrust.value.packageFingerprint !== pending.packageFingerprint ||
        recheckedTrust.value.contextFingerprint !== pending.contextFingerprint) {
        clear("claim-bundle-changed");
        return Object.freeze({ status: "blocked", reason: "claim-bundle-changed" });
      }
      if (recheckedTrust.value.registryRevision !== currentTrust.value.registryRevision ||
        recheckedTrust.value.registryFingerprint !== currentTrust.value.registryFingerprint) {
        clear("trust-checkpoint-conflict");
        return Object.freeze({ status: "blocked", reason: "trust-checkpoint-conflict" });
      }

      // Close the gap between trust refresh and subscription installation.
      const durableCheckpoint = canonicalCheckpoint(await this.config.checkpointStore.read());
      if (!durableCheckpoint || !sameCheckpoint(durableCheckpoint, expectedCheckpoint)) {
        clear("trust-checkpoint-conflict");
        return Object.freeze({ status: "blocked", reason: "trust-checkpoint-conflict" });
      }
      if (bundleInvalidated) {
        clear("claim-bundle-changed");
        return Object.freeze({ status: "blocked", reason: "claim-bundle-changed" });
      }
      if (trustInvalidated) {
        clear("trust-checkpoint-conflict");
        return Object.freeze({ status: "blocked", reason: "trust-checkpoint-conflict" });
      }
      if (progressInvalidated) {
        clear("progress-changed");
        return Object.freeze({ status: "blocked", reason: "progress-changed" });
      }

      const progress = await pending.runtime.verifyForPresentation(pending.receipt);
      if (bundleInvalidated) {
        clear("claim-bundle-changed");
        return Object.freeze({ status: "blocked", reason: "claim-bundle-changed" });
      }
      if (trustInvalidated) {
        clear("trust-checkpoint-conflict");
        return Object.freeze({ status: "blocked", reason: "trust-checkpoint-conflict" });
      }
      if (progressInvalidated) {
        clear("progress-changed");
        return Object.freeze({ status: "blocked", reason: "progress-changed" });
      }
      if (progress.status !== "ready") {
        const reason = mapPresentationFailure(progress);
        clear(reason);
        return Object.freeze({ status: "blocked", reason });
      }

      const permit: HoidTrustedPresentationPermit = Object.freeze({
        registryRevision: currentTrust.value.registryRevision,
        registryFingerprint: currentTrust.value.registryFingerprint,
        progressRevision: progress.progressRevision,
        progressFingerprint: progress.progressFingerprint,
      });
      // Keep independent invalidation subscriptions for every visible conversation answer.
      // New turns must not silently retract earlier messages. Bound retained listeners.
      if (this.activePresentations.size >= MAX_ACTIVE_PRESENTATIONS) {
        const oldest = this.activePresentations.keys().next().value as object | undefined;
        if (oldest) this.clearPresentation(oldest, "invalid-prepared-answer");
      }
      this.activePresentations.set(presentationToken, Object.freeze({
        token: presentationToken,
        sink,
        unsubscribers: Object.freeze([
          unsubscribeTrust, unsubscribeProgress, unsubscribeLocalProgress, unsubscribeBundle,
        ]),
      }));
      handedOff = true;
      // No await occurs between the final durable checks and this synchronous handoff.
      try {
        sink.present(pending.answer, permit);
      } catch {
        this.clearActivePresentation("presentation-sink-failed");
        return Object.freeze({ status: "blocked", reason: "presentation-sink-failed" });
      }
      if (!this.activePresentations.has(presentationToken)) {
        const reason = bundleInvalidated ? "claim-bundle-changed" :
          trustInvalidated ? "trust-checkpoint-conflict" : "progress-changed";
        return Object.freeze({ status: "blocked", reason });
      }
      return Object.freeze({
        status: "presented",
        registryRevision: permit.registryRevision,
        progressRevision: permit.progressRevision,
      });
    } catch {
      clear("trust-checkpoint-unavailable");
      return Object.freeze({ status: "blocked", reason: "trust-checkpoint-unavailable" });
    } finally {
      if (!handedOff) {
        unsubscribeTrust();
        unsubscribeProgress();
        unsubscribeLocalProgress();
        unsubscribeBundle();
      }
    }
  }

  async answerAndPresent(
    request: unknown,
    sink: HoidTrustedScreenAnswerPort,
    options: HoidExactRuntimeCallOptions = {},
  ): Promise<HoidTrustedAnswerPresentationResult> {
    const prepared = await this.prepare(request, options);
    if (prepared.status !== "prepared") {
      try { sink.clear(prepared.reason); } catch { /* fail closed */ }
      return Object.freeze({ status: "blocked", reason: prepared.reason });
    }
    return this.present(prepared.prepared, sink);
  }
}

export function createHoidTrustedExactUnitAnswerHost(config: unknown): HoidTrustedExactUnitAnswerHost | null {
  return HoidTrustedExactUnitAnswerHost.create(config);
}
