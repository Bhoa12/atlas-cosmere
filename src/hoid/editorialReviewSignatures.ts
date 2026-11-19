import type { HoidKnowledgeEntry } from "./catalog";
import {
  validateHoidApprovedClaimAttestation,
  type HoidApprovedClaim,
} from "./approvedClaimIntegrity";
import { sha256Hex } from "./sha256";

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,126}$/i;
const SHA_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const REF_PATTERN = /^[A-Za-z0-9_./-]{1,255}$/;
const PATH_PATTERN = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_./-]{1,240}$/;
const MAX_KEYS = 64;
const MAX_REGISTRY_DAYS = 90;
const DAY_MS = 86_400_000;

export type HoidEd25519VerificationRequest = Readonly<{
  publicKeyHex: string;
  message: string;
  signatureHex: string;
}>;

export type HoidEd25519VerificationPort = Readonly<{
  verify(request: HoidEd25519VerificationRequest): Promise<boolean>;
}>;

export type HoidReviewerTrustKey = Readonly<{
  keyId: string;
  reviewerId: string;
  algorithm: "Ed25519";
  publicKeyHex: string;
  status: "active" | "revoked";
  validFrom: string;
  validUntil: string;
  revokedAt: string | null;
  allowedRepositoryFullNames: readonly string[];
}>;

export type HoidReviewerTrustRegistryUnsigned = Readonly<{
  schemaVersion: 1;
  revision: number;
  issuedAt: string;
  expiresAt: string;
  keys: readonly HoidReviewerTrustKey[];
}>;

export type HoidReviewerTrustRegistry = HoidReviewerTrustRegistryUnsigned & Readonly<{
  rootSignature: Readonly<{
    algorithm: "Ed25519";
    keyId: string;
    signatureHex: string;
  }>;
}>;

export type HoidReviewerTrustRootKey = Readonly<{
  keyId: string;
  publicKeyHex: string;
}>;

export type HoidApprovedClaimReviewSignature = Readonly<{
  schemaVersion: 1;
  algorithm: "Ed25519";
  keyId: string;
  signatureHex: string;
}>;

export type HoidApprovedClaimReviewSignatureContext = Readonly<{
  schemaVersion: 1;
  repositoryFullName: string;
  pullRequestNumber: number;
  baseRef: string;
  baseSha: string;
  headRef: string;
  headSha: string;
  promotionManifestPath: string;
  promotionPlanFingerprint: string;
  reviewBundleFingerprint: string;
}>;

export type HoidReviewerTrustRegistryVerification =
  | Readonly<{
      status: "verified";
      revision: number;
      keyCount: number;
      expiresAt: string;
    }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-registry"
        | "invalid-root-key"
        | "root-key-mismatch"
        | "registry-not-current"
        | "registry-lifetime-exceeded"
        | "registry-rollback"
        | "invalid-minimum-revision"
        | "registry-signature-invalid"
        | "verifier-unavailable"
        | "cryptographic-verification-failed";
    }>;

export type HoidApprovedClaimSignatureVerification =
  | Readonly<{
      status: "verified";
      claimId: string;
      reviewerId: string;
      keyId: string;
      registryRevision: number;
      contextFingerprint: string;
      statementSha256: string;
      claimSha256: string;
      evidenceSha256: string;
      reviewSha256: string;
    }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-claim"
        | "invalid-context"
        | "invalid-signature-envelope"
        | "invalid-trust-registry"
        | "trust-root-invalid"
        | "registry-not-current"
        | "registry-rollback"
        | "invalid-minimum-revision"
        | "key-not-found"
        | "key-revoked"
        | "key-not-current"
        | "reviewer-key-mismatch"
        | "repository-not-authorized"
        | "signature-invalid"
        | "verifier-unavailable"
        | "cryptographic-verification-failed";
    }>;

type CanonicalContext = HoidApprovedClaimReviewSignatureContext;
type CanonicalRegistry = HoidReviewerTrustRegistry;
type CanonicalRootKey = HoidReviewerTrustRootKey;

function plainRecord(value: unknown): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

function exactRecord(
  value: unknown,
  allowed: readonly string[],
  required: readonly string[] = allowed,
): Record<string, unknown> | null {
  const record = plainRecord(value);
  if (!record) return null;
  try {
    const keys = Reflect.ownKeys(record);
    if (keys.some(key => typeof key !== "string" || !allowed.includes(key))) return null;
    const output = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string") return null;
      const descriptor = Object.getOwnPropertyDescriptor(record, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      output[key] = descriptor.value;
    }
    if (required.some(key => !Object.prototype.hasOwnProperty.call(output, key))) return null;
    return output;
  } catch {
    return null;
  }
}

function denseValues(value: unknown, maximum: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || value.length > maximum || Object.getPrototypeOf(value) !== Array.prototype) {
      return null;
    }
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const output: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      output.push(descriptor.value);
    }
    return Object.freeze(output);
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

function canonicalContext(value: unknown): CanonicalContext | null {
  const raw = exactRecord(value, [
    "schemaVersion", "repositoryFullName", "pullRequestNumber", "baseRef", "baseSha",
    "headRef", "headSha", "promotionManifestPath", "promotionPlanFingerprint",
    "reviewBundleFingerprint",
  ]);
  if (
    !raw ||
    raw.schemaVersion !== 1 ||
    typeof raw.repositoryFullName !== "string" ||
    !REPOSITORY_PATTERN.test(raw.repositoryFullName) ||
    !Number.isSafeInteger(raw.pullRequestNumber) ||
    (raw.pullRequestNumber as number) < 1 ||
    typeof raw.baseRef !== "string" ||
    !REF_PATTERN.test(raw.baseRef) ||
    typeof raw.headRef !== "string" ||
    !REF_PATTERN.test(raw.headRef) ||
    raw.baseRef === raw.headRef ||
    typeof raw.baseSha !== "string" ||
    !COMMIT_PATTERN.test(raw.baseSha) ||
    typeof raw.headSha !== "string" ||
    !COMMIT_PATTERN.test(raw.headSha) ||
    raw.baseSha === raw.headSha ||
    typeof raw.promotionManifestPath !== "string" ||
    !PATH_PATTERN.test(raw.promotionManifestPath) ||
    typeof raw.promotionPlanFingerprint !== "string" ||
    !SHA_PATTERN.test(raw.promotionPlanFingerprint) ||
    typeof raw.reviewBundleFingerprint !== "string" ||
    !SHA_PATTERN.test(raw.reviewBundleFingerprint)
  ) return null;

  return Object.freeze({
    schemaVersion: 1,
    repositoryFullName: raw.repositoryFullName,
    pullRequestNumber: raw.pullRequestNumber as number,
    baseRef: raw.baseRef,
    baseSha: raw.baseSha,
    headRef: raw.headRef,
    headSha: raw.headSha,
    promotionManifestPath: raw.promotionManifestPath,
    promotionPlanFingerprint: raw.promotionPlanFingerprint,
    reviewBundleFingerprint: raw.reviewBundleFingerprint,
  });
}

function canonicalRootKey(value: unknown): CanonicalRootKey | null {
  const raw = exactRecord(value, ["keyId", "publicKeyHex"]);
  if (
    !raw ||
    typeof raw.keyId !== "string" ||
    !ID_PATTERN.test(raw.keyId) ||
    typeof raw.publicKeyHex !== "string" ||
    !/^[a-f0-9]{64}$/.test(raw.publicKeyHex)
  ) return null;
  return Object.freeze({ keyId: raw.keyId, publicKeyHex: raw.publicKeyHex });
}

function canonicalKey(value: unknown): HoidReviewerTrustKey | null {
  const raw = exactRecord(value, [
    "keyId", "reviewerId", "algorithm", "publicKeyHex", "status", "validFrom",
    "validUntil", "revokedAt", "allowedRepositoryFullNames",
  ]);
  if (
    !raw ||
    typeof raw.keyId !== "string" ||
    !ID_PATTERN.test(raw.keyId) ||
    typeof raw.reviewerId !== "string" ||
    !ID_PATTERN.test(raw.reviewerId) ||
    raw.algorithm !== "Ed25519" ||
    typeof raw.publicKeyHex !== "string" ||
    !/^[a-f0-9]{64}$/.test(raw.publicKeyHex) ||
    (raw.status !== "active" && raw.status !== "revoked") ||
    !isoTimestamp(raw.validFrom) ||
    !isoTimestamp(raw.validUntil) ||
    Date.parse(raw.validUntil) <= Date.parse(raw.validFrom) ||
    !(raw.revokedAt === null || isoTimestamp(raw.revokedAt)) ||
    (raw.status === "active" && raw.revokedAt !== null) ||
    (raw.status === "revoked" && raw.revokedAt === null)
  ) return null;

  const repositories = denseValues(raw.allowedRepositoryFullNames, 32);
  if (!repositories || repositories.length === 0) return null;
  const names: string[] = [];
  for (const item of repositories) {
    if (typeof item !== "string" || !REPOSITORY_PATTERN.test(item)) return null;
    names.push(item);
  }
  if (new Set(names).size !== names.length) return null;
  const sorted = [...names].sort();
  if (JSON.stringify(sorted) !== JSON.stringify(names)) return null;

  return Object.freeze({
    keyId: raw.keyId,
    reviewerId: raw.reviewerId,
    algorithm: "Ed25519",
    publicKeyHex: raw.publicKeyHex,
    status: raw.status,
    validFrom: raw.validFrom,
    validUntil: raw.validUntil,
    revokedAt: raw.revokedAt as string | null,
    allowedRepositoryFullNames: Object.freeze(names),
  });
}

function canonicalRegistry(value: unknown): CanonicalRegistry | null {
  const raw = exactRecord(value, [
    "schemaVersion", "revision", "issuedAt", "expiresAt", "keys", "rootSignature",
  ]);
  if (
    !raw ||
    raw.schemaVersion !== 1 ||
    !Number.isSafeInteger(raw.revision) ||
    (raw.revision as number) < 1 ||
    !isoTimestamp(raw.issuedAt) ||
    !isoTimestamp(raw.expiresAt) ||
    Date.parse(raw.expiresAt) <= Date.parse(raw.issuedAt)
  ) return null;

  const rawKeys = denseValues(raw.keys, MAX_KEYS);
  if (!rawKeys || rawKeys.length === 0) return null;
  const keys: HoidReviewerTrustKey[] = [];
  const keyIds = new Set<string>();
  const publicKeys = new Set<string>();
  for (const item of rawKeys) {
    const key = canonicalKey(item);
    if (!key || keyIds.has(key.keyId) || publicKeys.has(key.publicKeyHex)) return null;
    keyIds.add(key.keyId);
    publicKeys.add(key.publicKeyHex);
    keys.push(key);
  }
  const sortedKeys = [...keys].sort((left, right) => left.keyId.localeCompare(right.keyId));
  if (JSON.stringify(sortedKeys) !== JSON.stringify(keys)) return null;

  const signature = exactRecord(raw.rootSignature, ["algorithm", "keyId", "signatureHex"]);
  if (
    !signature ||
    signature.algorithm !== "Ed25519" ||
    typeof signature.keyId !== "string" ||
    !ID_PATTERN.test(signature.keyId) ||
    typeof signature.signatureHex !== "string" ||
    !/^[a-f0-9]{128}$/.test(signature.signatureHex)
  ) return null;

  return Object.freeze({
    schemaVersion: 1,
    revision: raw.revision as number,
    issuedAt: raw.issuedAt,
    expiresAt: raw.expiresAt,
    keys: Object.freeze(keys),
    rootSignature: Object.freeze({
      algorithm: "Ed25519",
      keyId: signature.keyId,
      signatureHex: signature.signatureHex,
    }),
  });
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
    !/^[a-f0-9]{128}$/.test(raw.signatureHex)
  ) return null;
  return Object.freeze({
    schemaVersion: 1,
    algorithm: "Ed25519",
    keyId: raw.keyId,
    signatureHex: raw.signatureHex,
  });
}

function registryPayload(
  registry: Pick<HoidReviewerTrustRegistryUnsigned, "schemaVersion" | "revision" | "issuedAt" | "expiresAt" | "keys">,
): string {
  return JSON.stringify([
    "hoid-reviewer-trust-registry-ed25519-v1",
    registry.schemaVersion,
    registry.revision,
    registry.issuedAt,
    registry.expiresAt,
    registry.keys.map(key => [
      key.keyId,
      key.reviewerId,
      key.algorithm,
      key.publicKeyHex,
      key.status,
      key.validFrom,
      key.validUntil,
      key.revokedAt,
      key.allowedRepositoryFullNames,
    ]),
  ]);
}

/** Canonical root-signing payload; contains public keys and metadata only. */
export function buildHoidReviewerTrustRegistrySigningMessage(value: unknown): string | null {
  const raw = exactRecord(value, ["schemaVersion", "revision", "issuedAt", "expiresAt", "keys"]);
  if (
    !raw ||
    raw.schemaVersion !== 1 ||
    !Number.isSafeInteger(raw.revision) ||
    (raw.revision as number) < 1 ||
    !isoTimestamp(raw.issuedAt) ||
    !isoTimestamp(raw.expiresAt)
  ) return null;
  const rawKeys = denseValues(raw.keys, MAX_KEYS);
  if (!rawKeys || rawKeys.length === 0) return null;
  const keys: HoidReviewerTrustKey[] = [];
  for (const item of rawKeys) {
    const key = canonicalKey(item);
    if (!key) return null;
    keys.push(key);
  }
  const sorted = [...keys].sort((left, right) => left.keyId.localeCompare(right.keyId));
  if (
    new Set(keys.map(key => key.keyId)).size !== keys.length ||
    new Set(keys.map(key => key.publicKeyHex)).size !== keys.length ||
    JSON.stringify(sorted) !== JSON.stringify(keys)
  ) return null;
  return registryPayload(Object.freeze({
    schemaVersion: 1,
    revision: raw.revision as number,
    issuedAt: raw.issuedAt,
    expiresAt: raw.expiresAt,
    keys: Object.freeze(keys),
  }));
}

/** Canonical claim payload for an offline or hardware-backed reviewer signer. */
export function buildHoidApprovedClaimReviewSigningMessage(
  claimInput: unknown,
  knowledgeInput: readonly HoidKnowledgeEntry[],
  contextInput: unknown,
  keyIdInput: unknown,
): string | null {
  const validation = validateHoidApprovedClaimAttestation(claimInput, knowledgeInput);
  if (validation.status !== "valid") return null;
  const context = canonicalContext(contextInput);
  if (!context || typeof keyIdInput !== "string" || !ID_PATTERN.test(keyIdInput)) return null;
  const claim = validation.claim;
  return JSON.stringify([
    "hoid-approved-claim-review-ed25519-v1",
    context.repositoryFullName,
    context.pullRequestNumber,
    context.baseRef,
    context.baseSha,
    context.headRef,
    context.headSha,
    context.promotionManifestPath,
    context.promotionPlanFingerprint,
    context.reviewBundleFingerprint,
    claim.id,
    claim.review.status,
    claim.review.origin,
    claim.review.reviewerId,
    claim.review.reviewedAt,
    claim.integrity.schemaVersion,
    claim.integrity.statementSha256,
    claim.integrity.claimSha256,
    claim.integrity.evidenceSha256,
    claim.integrity.reviewSha256,
    keyIdInput,
  ]);
}

function verifierMethod(value: unknown): ((request: HoidEd25519VerificationRequest) => Promise<boolean>) | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    let current: object | null = value;
    for (let depth = 0; current !== null && current !== Object.prototype && depth < 5; depth += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(current, "verify");
      if (descriptor) {
        if (
          !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          typeof descriptor.value !== "function"
        ) return null;
        return (descriptor.value as (request: HoidEd25519VerificationRequest) => Promise<boolean>).bind(value);
      }
      current = Object.getPrototypeOf(current) as object | null;
    }
    return null;
  } catch {
    return null;
  }
}

async function verifySignature(
  verifier: (request: HoidEd25519VerificationRequest) => Promise<boolean>,
  request: HoidEd25519VerificationRequest,
): Promise<"valid" | "invalid" | "error"> {
  try {
    return await verifier(request) === true ? "valid" : "invalid";
  } catch {
    return "error";
  }
}

function invalidRegistry(
  reason: Extract<HoidReviewerTrustRegistryVerification, { status: "invalid" }>["reason"],
): HoidReviewerTrustRegistryVerification {
  return Object.freeze({ status: "invalid", reason });
}

export async function verifyHoidReviewerTrustRegistry(
  registryInput: unknown,
  rootKeyInput: unknown,
  verifierInput: unknown,
  nowInput: unknown,
  minimumRevisionInput: unknown,
): Promise<HoidReviewerTrustRegistryVerification> {
  const registry = canonicalRegistry(registryInput);
  if (!registry) return invalidRegistry("invalid-registry");
  const rootKey = canonicalRootKey(rootKeyInput);
  if (!rootKey) return invalidRegistry("invalid-root-key");
  if (registry.rootSignature.keyId !== rootKey.keyId) return invalidRegistry("root-key-mismatch");
  if (!isoTimestamp(nowInput)) return invalidRegistry("registry-not-current");
  if (!Number.isSafeInteger(minimumRevisionInput) || (minimumRevisionInput as number) < 1) {
    return invalidRegistry("invalid-minimum-revision");
  }
  if (registry.revision < (minimumRevisionInput as number)) return invalidRegistry("registry-rollback");

  const now = Date.parse(nowInput);
  const issuedAt = Date.parse(registry.issuedAt);
  const expiresAt = Date.parse(registry.expiresAt);
  if (
    issuedAt > now ||
    expiresAt < now ||
    expiresAt - issuedAt > MAX_REGISTRY_DAYS * DAY_MS
  ) return invalidRegistry(
    expiresAt - issuedAt > MAX_REGISTRY_DAYS * DAY_MS
      ? "registry-lifetime-exceeded"
      : "registry-not-current",
  );

  const verify = verifierMethod(verifierInput);
  if (!verify) return invalidRegistry("verifier-unavailable");
  const outcome = await verifySignature(verify, {
    publicKeyHex: rootKey.publicKeyHex,
    message: registryPayload(registry),
    signatureHex: registry.rootSignature.signatureHex,
  });
  if (outcome === "error") return invalidRegistry("cryptographic-verification-failed");
  if (outcome !== "valid") return invalidRegistry("registry-signature-invalid");

  return Object.freeze({
    status: "verified",
    revision: registry.revision,
    keyCount: registry.keys.length,
    expiresAt: registry.expiresAt,
  });
}

function invalidClaimSignature(
  reason: Extract<HoidApprovedClaimSignatureVerification, { status: "invalid" }>["reason"],
): HoidApprovedClaimSignatureVerification {
  return Object.freeze({ status: "invalid", reason });
}

export async function verifyHoidApprovedClaimReviewSignature(
  claimInput: unknown,
  knowledgeInput: readonly HoidKnowledgeEntry[],
  contextInput: unknown,
  signatureInput: unknown,
  registryInput: unknown,
  rootKeyInput: unknown,
  verifierInput: unknown,
  nowInput: unknown,
  minimumRegistryRevisionInput: unknown,
): Promise<HoidApprovedClaimSignatureVerification> {
  const claimValidation = validateHoidApprovedClaimAttestation(claimInput, knowledgeInput);
  if (claimValidation.status !== "valid") return invalidClaimSignature("invalid-claim");
  const claim: HoidApprovedClaim = claimValidation.claim;
  const context = canonicalContext(contextInput);
  if (!context) return invalidClaimSignature("invalid-context");
  const signature = canonicalSignature(signatureInput);
  if (!signature) return invalidClaimSignature("invalid-signature-envelope");

  const registryValidation = await verifyHoidReviewerTrustRegistry(
    registryInput,
    rootKeyInput,
    verifierInput,
    nowInput,
    minimumRegistryRevisionInput,
  );
  if (registryValidation.status !== "verified") {
    return invalidClaimSignature(
      registryValidation.reason === "verifier-unavailable"
        ? "verifier-unavailable"
        : registryValidation.reason === "cryptographic-verification-failed"
          ? "cryptographic-verification-failed"
          : registryValidation.reason === "registry-not-current" ||
              registryValidation.reason === "registry-lifetime-exceeded"
            ? "registry-not-current"
            : registryValidation.reason === "registry-rollback"
              ? "registry-rollback"
              : registryValidation.reason === "invalid-minimum-revision"
                ? "invalid-minimum-revision"
                : "trust-root-invalid",
    );
  }

  const registry = canonicalRegistry(registryInput);
  if (!registry) return invalidClaimSignature("invalid-trust-registry");
  const key = registry.keys.find(candidate => candidate.keyId === signature.keyId);
  if (!key) return invalidClaimSignature("key-not-found");
  if (key.status === "revoked" || key.revokedAt !== null) return invalidClaimSignature("key-revoked");
  if (
    !isoTimestamp(nowInput) ||
    Date.parse(nowInput) < Date.parse(key.validFrom) ||
    Date.parse(nowInput) > Date.parse(key.validUntil) ||
    Date.parse(claim.review.reviewedAt) < Date.parse(key.validFrom) ||
    Date.parse(claim.review.reviewedAt) > Date.parse(key.validUntil) ||
    Date.parse(claim.review.reviewedAt) > Date.parse(nowInput)
  ) return invalidClaimSignature("key-not-current");
  if (key.reviewerId !== claim.review.reviewerId) return invalidClaimSignature("reviewer-key-mismatch");
  if (!key.allowedRepositoryFullNames.includes(context.repositoryFullName)) {
    return invalidClaimSignature("repository-not-authorized");
  }

  const message = buildHoidApprovedClaimReviewSigningMessage(
    claim,
    knowledgeInput,
    context,
    signature.keyId,
  );
  if (message === null) return invalidClaimSignature("invalid-claim");
  const verify = verifierMethod(verifierInput);
  if (!verify) return invalidClaimSignature("verifier-unavailable");
  const outcome = await verifySignature(verify, {
    publicKeyHex: key.publicKeyHex,
    message,
    signatureHex: signature.signatureHex,
  });
  if (outcome === "error") return invalidClaimSignature("cryptographic-verification-failed");
  if (outcome !== "valid") return invalidClaimSignature("signature-invalid");

  return Object.freeze({
    status: "verified",
    claimId: claim.id,
    reviewerId: claim.review.reviewerId,
    keyId: key.keyId,
    registryRevision: registry.revision,
    contextFingerprint: sha256Hex(message),
    statementSha256: claim.integrity.statementSha256,
    claimSha256: claim.integrity.claimSha256,
    evidenceSha256: claim.integrity.evidenceSha256,
    reviewSha256: claim.integrity.reviewSha256,
  });
}

function hexBytes(value: string): Uint8Array {
  const output = new Uint8Array(value.length / 2);
  for (let index = 0; index < output.length; index += 1) {
    output[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return output;
}

export type HoidWebCryptoSubtlePort = Pick<SubtleCrypto, "importKey" | "verify">;
export type HoidUtf8EncoderPort = (value: string) => Uint8Array;

/**
 * Optional WebCrypto adapter. The host must inject a runtime that actually
 * supports Ed25519; the Hoid core never assumes Expo/Hermes provides it.
 */
export function createHoidWebCryptoEd25519VerificationPort(
  subtle: HoidWebCryptoSubtlePort,
  encodeUtf8: HoidUtf8EncoderPort = value => new TextEncoder().encode(value),
): HoidEd25519VerificationPort {
  return Object.freeze({
    async verify(request: HoidEd25519VerificationRequest): Promise<boolean> {
      if (
        !/^[a-f0-9]{64}$/.test(request.publicKeyHex) ||
        !/^[a-f0-9]{128}$/.test(request.signatureHex) ||
        typeof request.message !== "string"
      ) return false;
      try {
        const publicKey = await subtle.importKey(
          "raw",
          hexBytes(request.publicKeyHex),
          { name: "Ed25519" },
          false,
          ["verify"],
        );
        return await subtle.verify(
          { name: "Ed25519" },
          publicKey,
          hexBytes(request.signatureHex),
          encodeUtf8(request.message),
        );
      } catch {
        return false;
      }
    },
  });
}
