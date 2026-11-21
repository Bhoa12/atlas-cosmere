import type { HoidKnowledgeEntry } from "./catalog";
import type { HoidApprovedClaim } from "./approvedClaimIntegrity";
import type {
  HoidReviewerTrustRegistry,
} from "./editorialReviewSignatures";
import type { HoidTrustedHostBootstrapPort } from "./trustedHostBootstrap";
import {
  createHoidNobleEd25519VerificationPort,
} from "./nobleEd25519VerificationAdapter";
import {
  createHoidRemoteTrustRegistryRevisionStorePort,
  type HoidTrustRevisionWitnessConfiguration,
  type HoidTrustRevisionWitnessTransportPort,
  type HoidTrustRevisionWitnessNoncePort,
  type HoidTrustRevisionWitnessClockPort,
} from "./remoteTrustRevisionWitness";
import {
  createHoidTrustedVerifiedAnswerPresenter,
  type HoidTrustedClockPort,
  type HoidTrustedVerifiedAnswerPresenter,
} from "./trustedVerifiedAnswerPresentation";
import { createHoidRefreshableTrustedReadingProgressPort } from "./trustedPresentationHostAdapters";

export type HoidTrustedPresentationHostBuild =
  | Readonly<{
      status: "ready";
      presenter: HoidTrustedVerifiedAnswerPresenter;
      verifiedClaimCount: number;
      trustRegistryRevision: number;
      bootstrapFingerprint: string;
      expiresAt: string;
    }>
  | Readonly<{
      status: "blocked";
      reason:
        | "invalid-host-config"
        | "progress-refresh-unavailable"
        | "witness-adapter-unavailable"
        | "trusted-presenter-blocked";
      presenterReason?: string;
    }>;

type HostMethod = (...args: unknown[]) => unknown;

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length !== keys.length ||
      ownKeys.some(key => typeof key !== "string" || !keys.includes(key))
    ) return null;

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return null;
  }
}

function resolveMethod(value: unknown, name: string): HostMethod | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    let current: object | null = value;
    for (let depth = 0; current !== null && current !== Object.prototype && depth < 5; depth += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(current, name);
      if (descriptor) {
        if (
          !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          typeof descriptor.value !== "function"
        ) return null;
        return (descriptor.value as HostMethod).bind(value);
      }
      current = Object.getPrototypeOf(current) as object | null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Production composition root for the trusted presenter.
 *
 * All authority-bearing dependencies are injected by the native host:
 * - a root-key bootstrap pinned outside the provider/UI boundary;
 * - a reviewer registry signed by that root;
 * - a witness transport authenticated by the host;
 * - an OS-CSPRNG nonce source;
 * - a host clock;
 * - a refresh operation backed by the authoritative cursor store.
 *
 * This module creates the real Noble Ed25519 verifier and the signed remote
 * monotonic revision adapter. It never creates credentials, provisions trust,
 * accepts provider-supplied progress, or performs editorial promotion.
 */
export async function createHoidTrustedPresentationHost(
  configInput: unknown,
): Promise<HoidTrustedPresentationHostBuild> {
  const config = exactRecord(configInput, [
    "knowledge",
    "signedClaims",
    "context",
    "trustRegistry",
    "bootstrapPort",
    "expectedRepositoryFullName",
    "witnessConfiguration",
    "witnessTransport",
    "noncePort",
    "clock",
    "progressRefreshPort",
  ]);
  if (!config) return Object.freeze({ status: "blocked", reason: "invalid-host-config" });

  const clockNow = resolveMethod(config.clock, "now");
  if (!clockNow) return Object.freeze({ status: "blocked", reason: "invalid-host-config" });

  const progressPort = createHoidRefreshableTrustedReadingProgressPort(config.progressRefreshPort);
  if (!progressPort) {
    return Object.freeze({ status: "blocked", reason: "progress-refresh-unavailable" });
  }

  const verifier = createHoidNobleEd25519VerificationPort();
  let revisionStore;
  try {
    revisionStore = createHoidRemoteTrustRegistryRevisionStorePort({
      configuration: config.witnessConfiguration as HoidTrustRevisionWitnessConfiguration,
      transport: config.witnessTransport as HoidTrustRevisionWitnessTransportPort,
      noncePort: config.noncePort as HoidTrustRevisionWitnessNoncePort,
      clock: config.clock as HoidTrustRevisionWitnessClockPort,
      verifier,
    });
  } catch {
    return Object.freeze({ status: "blocked", reason: "witness-adapter-unavailable" });
  }

  const trustedClock: HoidTrustedClockPort = Object.freeze({
    now: () => clockNow(),
  });
  const presenterBuild = await createHoidTrustedVerifiedAnswerPresenter(Object.freeze({
    knowledge: config.knowledge as readonly HoidKnowledgeEntry[],
    signedClaims: config.signedClaims,
    context: config.context,
    trustRegistry: config.trustRegistry as HoidReviewerTrustRegistry,
    verifier,
    bootstrapPort: config.bootstrapPort as HoidTrustedHostBootstrapPort,
    revisionStore,
    progressPort,
    expectedRepositoryFullName: config.expectedRepositoryFullName,
    clock: trustedClock,
  }));

  if (presenterBuild.status !== "ready") {
    return Object.freeze({
      status: "blocked",
      reason: "trusted-presenter-blocked",
      presenterReason: presenterBuild.reason,
    });
  }

  return Object.freeze({
    status: "ready",
    presenter: presenterBuild.presenter,
    verifiedClaimCount: presenterBuild.verifiedClaimCount,
    trustRegistryRevision: presenterBuild.trustRegistryRevision,
    bootstrapFingerprint: presenterBuild.bootstrapFingerprint,
    expiresAt: presenterBuild.expiresAt,
  });
}
