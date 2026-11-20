import type { HoidKnowledgeEntry } from "./catalog";
import type { HoidApprovedClaim } from "./approvedClaimIntegrity";
import {
  buildHoidApprovedClaimReviewSigningMessage,
  verifyHoidReviewerBoundPayloadSignatures,
  type HoidApprovedClaimReviewSignature,
  type HoidApprovedClaimReviewSignatureContext,
  type HoidEd25519VerificationPort,
  type HoidReviewerBoundPayloadSignatureRequest,
  type HoidReviewerTrustRegistry,
} from "./editorialReviewSignatures";
import {
  loadHoidTrustedHostBootstrap,
  type HoidTrustedHostBootstrapPort,
} from "./trustedHostBootstrap";
import {
  persistHoidTrustRegistryMinimumRevision,
  type HoidTrustRegistryRevisionStorePort,
} from "./trustRegistryRevisionStore";
import {
  verifyHoidTrustedHostRevisionStore,
} from "./trustedHostBootstrap";
import {
  createHoidVerifiedAnswerPresenter,
  type HoidVerifiedAnswerPresenter,
} from "./verifiedAnswerPresentation";
import {
  presentHoidEvidenceAnswer,
  type HoidAnswerPresentation,
} from "./answerPresentation";
import { validateHoidApprovedClaimAttestation } from "./approvedClaimIntegrity";

export type HoidSignedApprovedClaimEnvelope = Readonly<{
  claim: HoidApprovedClaim;
  signature: HoidApprovedClaimReviewSignature;
}>;

export type HoidTrustedClockPort = Readonly<{
  now(): unknown;
}>;

export type HoidTrustedVerifiedAnswerPresenter = Readonly<{
  present(answer: unknown, progress: unknown): Promise<HoidAnswerPresentation>;
}>;

export type HoidTrustedVerifiedAnswerPresenterBuild =
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
        | "invalid-config"
        | "invalid-clock"
        | "invalid-signed-claims"
        | "bootstrap-blocked"
        | "revision-store-blocked"
        | "registry-persistence-blocked"
        | "signature-verification-failed"
        | "signature-verification-timeout"
        | "presenter-unavailable";
    }>;

const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,126}$/i;
const SHA_PATTERN = /^[a-f0-9]{64}$/;
const SIGNATURE_PATTERN = /^[a-f0-9]{128}$/;
const MAX_SIGNED_CLAIMS = 512;
const SIGNATURE_TIMEOUT_MS = 30_000;
const PRESENTATION_STORE_TIMEOUT_MS = 3_000;

type UnknownMethod = (...args: unknown[]) => unknown;
type Timed<T> =
  | Readonly<{ status: "value"; value: T }>
  | Readonly<{ status: "timeout" }>
  | Readonly<{ status: "error" }>;

function blocked(reason: Extract<HoidTrustedVerifiedAnswerPresenterBuild, { status: "blocked" }>["reason"]): HoidTrustedVerifiedAnswerPresenterBuild {
  return Object.freeze({ status: "blocked", reason });
}

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== keys.length) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of ownKeys) {
      if (typeof key !== "string" || !keys.includes(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) return null;
      result[key] = descriptor.value;
    }
    for (const key of keys) if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    return result;
  } catch {
    return null;
  }
}

function ownDataValue(value: unknown, key: string): unknown {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) return undefined;
    return descriptor.value;
  } catch {
    return undefined;
  }
}

function denseArray(value: unknown, maximum: number, minimum = 0): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || value.length < minimum || value.length > maximum || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) return null;
      result.push(descriptor.value);
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function resolveMethod(value: unknown, name: string): UnknownMethod | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    let current: object | null = value;
    for (let depth = 0; current !== null && current !== Object.prototype && depth < 5; depth += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(current, name);
      if (descriptor) {
        if (!Object.prototype.hasOwnProperty.call(descriptor, "value") || typeof descriptor.value !== "function") return null;
        return (descriptor.value as UnknownMethod).bind(value);
      }
      current = Object.getPrototypeOf(current) as object | null;
    }
    return null;
  } catch {
    return null;
  }
}

function isoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  try {
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
  } catch {
    return false;
  }
}

function canonicalSignature(value: unknown): HoidApprovedClaimReviewSignature | null {
  const raw = exactRecord(value, ["schemaVersion", "algorithm", "keyId", "signatureHex"]);
  if (
    !raw ||
    raw.schemaVersion !== 1 ||
    raw.algorithm !== "Ed25519" ||
    typeof raw.keyId !== "string" ||
    !ID_PATTERN.test(raw.keyId) ||
    typeof raw.signatureHex !== "string" ||
    !SIGNATURE_PATTERN.test(raw.signatureHex)
  ) return null;
  return Object.freeze({
    schemaVersion: 1,
    algorithm: "Ed25519",
    keyId: raw.keyId,
    signatureHex: raw.signatureHex,
  });
}

type SignedClaimMaterial = Readonly<{
  claims: readonly HoidApprovedClaim[];
  requests: readonly HoidReviewerBoundPayloadSignatureRequest[];
}>;

function canonicalSignedClaims(
  knowledgeInput: unknown,
  signedClaimsInput: unknown,
  contextInput: unknown,
  expectedRepositoryFullName: string,
): SignedClaimMaterial | null {
  if (ownDataValue(contextInput, "repositoryFullName") !== expectedRepositoryFullName) return null;
  const entries = denseArray(signedClaimsInput, MAX_SIGNED_CLAIMS, 1);
  if (!entries) return null;
  const claims: HoidApprovedClaim[] = [];
  const requests: HoidReviewerBoundPayloadSignatureRequest[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const envelope = exactRecord(entry, ["claim", "signature"]);
    if (!envelope) return null;
    const validation = validateHoidApprovedClaimAttestation(
      envelope.claim,
      knowledgeInput as readonly HoidKnowledgeEntry[],
    );
    if (validation.status !== "valid" || seen.has(validation.claim.id)) return null;
    const signature = canonicalSignature(envelope.signature);
    if (!signature) return null;
    const message = buildHoidApprovedClaimReviewSigningMessage(
      validation.claim,
      knowledgeInput as readonly HoidKnowledgeEntry[],
      contextInput as HoidApprovedClaimReviewSignatureContext,
      signature.keyId,
    );
    if (message === null || message.length < 1 || message.length > 32_768) return null;
    seen.add(validation.claim.id);
    claims.push(validation.claim);
    requests.push(Object.freeze({
      repositoryFullName: expectedRepositoryFullName,
      reviewerId: validation.claim.review.reviewerId,
      reviewedAt: validation.claim.review.reviewedAt,
      keyId: signature.keyId,
      message,
      signatureHex: signature.signatureHex,
    }));
  }
  return Object.freeze({
    claims: Object.freeze(claims),
    requests: Object.freeze(requests),
  });
}

async function withTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<Timed<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const work = Promise.resolve().then(operation).then<Timed<T>, Timed<T>>(
    value => Object.freeze({ status: "value", value }),
    () => Object.freeze({ status: "error" }),
  );
  const timeout = new Promise<Timed<T>>(resolve => {
    timer = setTimeout(() => resolve(Object.freeze({ status: "timeout" })), timeoutMs);
  });
  const result = await Promise.race([work, timeout]);
  if (timer !== undefined) clearTimeout(timer);
  return result;
}

async function readExactRevision(
  readMinimumRevision: UnknownMethod,
  trustDomainId: string,
): Promise<number | null> {
  const result = await withTimeout(
    () => Promise.resolve(readMinimumRevision(Object.freeze({ trustDomainId }))),
    PRESENTATION_STORE_TIMEOUT_MS,
  );
  if (result.status !== "value" || !Number.isSafeInteger(result.value) || (result.value as number) < 1) return null;
  return result.value as number;
}

function withheld(progress: unknown): HoidAnswerPresentation {
  return presentHoidEvidenceAnswer({ status: "blocked" }, progress);
}

/**
 * Builds a production-facing answer presenter only after every claim carries
 * an Ed25519 review signature accepted by a host-pinned root and a durable,
 * monotonic trust-registry revision store.
 *
 * Hash attestations alone are integrity metadata, not reviewer authentication.
 * The host must supply bootstrap, clock, verifier and revision-store ports from
 * trusted configuration; none may come from a provider response or user input.
 */
export async function createHoidTrustedVerifiedAnswerPresenter(
  configInput: unknown,
): Promise<HoidTrustedVerifiedAnswerPresenterBuild> {
  const config = exactRecord(configInput, [
    "knowledge",
    "signedClaims",
    "context",
    "trustRegistry",
    "verifier",
    "bootstrapPort",
    "revisionStore",
    "expectedRepositoryFullName",
    "clock",
  ]);
  if (!config) return blocked("invalid-config");

  const expectedRepositoryFullName = config.expectedRepositoryFullName;
  if (typeof expectedRepositoryFullName !== "string" || !REPOSITORY_PATTERN.test(expectedRepositoryFullName)) {
    return blocked("invalid-config");
  }

  const clockMethod = resolveMethod(config.clock, "now");
  const bootstrapRead = resolveMethod(config.bootstrapPort, "readPinnedConfiguration");
  const readMinimumRevision = resolveMethod(config.revisionStore, "readMinimumRevision");
  const compareAndSetMinimumRevision = resolveMethod(config.revisionStore, "compareAndSetMinimumRevision");
  if (!clockMethod || !bootstrapRead || !readMinimumRevision || !compareAndSetMinimumRevision) {
    return blocked("invalid-config");
  }

  let nowInput: unknown;
  try {
    nowInput = clockMethod();
  } catch {
    return blocked("invalid-clock");
  }
  if (!isoTimestamp(nowInput)) return blocked("invalid-clock");

  const material = canonicalSignedClaims(
    config.knowledge,
    config.signedClaims,
    config.context,
    expectedRepositoryFullName,
  );
  if (!material) return blocked("invalid-signed-claims");

  const bootstrapPort = Object.freeze({
    readPinnedConfiguration: () => Promise.resolve(bootstrapRead()),
  }) as HoidTrustedHostBootstrapPort;
  const revisionStore = Object.freeze({
    readMinimumRevision: (input: Readonly<{ trustDomainId: string }>) =>
      Promise.resolve(readMinimumRevision(input)),
    compareAndSetMinimumRevision: (input: Readonly<{
      trustDomainId: string;
      expectedRevision: number;
      nextRevision: number;
    }>) => Promise.resolve(compareAndSetMinimumRevision(input)),
  }) as HoidTrustRegistryRevisionStorePort;

  let bootstrap: Awaited<ReturnType<typeof loadHoidTrustedHostBootstrap>>;
  try {
    bootstrap = await loadHoidTrustedHostBootstrap(
      bootstrapPort,
      expectedRepositoryFullName,
      nowInput,
    );
  } catch {
    return blocked("bootstrap-blocked");
  }
  if (bootstrap.status !== "ready") return blocked("bootstrap-blocked");

  const storeCheck = await verifyHoidTrustedHostRevisionStore(
    bootstrap.configuration,
    revisionStore,
    expectedRepositoryFullName,
    nowInput,
  );
  if (storeCheck.status !== "ready") return blocked("revision-store-blocked");

  const persistence = await persistHoidTrustRegistryMinimumRevision(
    config.trustRegistry as HoidReviewerTrustRegistry,
    bootstrap.configuration.rootKey,
    config.verifier as HoidEd25519VerificationPort,
    nowInput,
    bootstrap.configuration.trustDomainId,
    revisionStore,
  );
  if (
    persistence.status !== "persisted" ||
    persistence.minimumRevision !== persistence.registryRevision
  ) return blocked("registry-persistence-blocked");

  const verification = await withTimeout(
    () => verifyHoidReviewerBoundPayloadSignatures(
      material.requests,
      config.trustRegistry as HoidReviewerTrustRegistry,
      bootstrap.configuration.rootKey,
      config.verifier as HoidEd25519VerificationPort,
      nowInput,
      persistence.minimumRevision,
    ),
    SIGNATURE_TIMEOUT_MS,
  );
  if (verification.status === "timeout") return blocked("signature-verification-timeout");
  if (
    verification.status !== "value" ||
    verification.value.status !== "verified" ||
    verification.value.verifiedCount !== material.claims.length ||
    verification.value.registryRevision !== persistence.registryRevision
  ) return blocked("signature-verification-failed");

  const registryExpiresAt = ownDataValue(config.trustRegistry, "expiresAt");
  if (!isoTimestamp(registryExpiresAt) || Date.parse(registryExpiresAt) <= Date.parse(nowInput)) {
    return blocked("registry-persistence-blocked");
  }

  const innerPresenter: HoidVerifiedAnswerPresenter | null = createHoidVerifiedAnswerPresenter({
    knowledge: config.knowledge as readonly HoidKnowledgeEntry[],
    claims: material.claims,
  });
  if (!innerPresenter) return blocked("presenter-unavailable");

  const trustDomainId = bootstrap.configuration.trustDomainId;
  const registryRevision = persistence.registryRevision;
  const verifiedAt = nowInput;
  const bootstrapFingerprint = bootstrap.configurationFingerprint;
  const bootstrapExpiresAt = bootstrap.configuration.expiresAt;

  const presenter: HoidTrustedVerifiedAnswerPresenter = Object.freeze({
    async present(answer: unknown, progress: unknown): Promise<HoidAnswerPresentation> {
      try {
        const currentNow = clockMethod();
        if (
          !isoTimestamp(currentNow) ||
          Date.parse(currentNow) < Date.parse(verifiedAt) ||
          Date.parse(currentNow) >= Date.parse(registryExpiresAt) ||
          Date.parse(currentNow) >= Date.parse(bootstrapExpiresAt)
        ) return withheld(progress);

        const currentBootstrap = await loadHoidTrustedHostBootstrap(
          bootstrapPort,
          expectedRepositoryFullName,
          currentNow,
        );
        if (
          currentBootstrap.status !== "ready" ||
          currentBootstrap.configurationFingerprint !== bootstrapFingerprint
        ) return withheld(progress);

        const currentRevision = await readExactRevision(readMinimumRevision, trustDomainId);
        if (currentRevision !== registryRevision) return withheld(progress);

        return innerPresenter.present(answer, progress);
      } catch {
        return withheld(progress);
      }
    },
  });

  return Object.freeze({
    status: "ready",
    presenter,
    verifiedClaimCount: material.claims.length,
    trustRegistryRevision: registryRevision,
    bootstrapFingerprint,
    expiresAt: registryExpiresAt,
  });
}
