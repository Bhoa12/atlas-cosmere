import {
  validateHoidExactApprovedClaimAttestation,
  type HoidExactApprovedClaim,
  type HoidExactEvidenceRecord,
} from "./exactUnitClaimIntegrity";
import {
  canonicalizeHoidExactUnitEvidencePolicy,
  type HoidExactUnitEvidencePolicy,
} from "./unitEvidenceAuthorizationV2";
import {
  verifyHoidReviewerBoundPayloadSignatures,
  type HoidApprovedClaimReviewSignatureContext,
  type HoidEd25519VerificationPort,
  type HoidReviewerBoundPayloadSignatureBatchVerification,
  type HoidReviewerTrustRegistry,
  type HoidReviewerTrustRootKey,
} from "./editorialReviewSignatures";
import {
  createHoidExactUnitEvidenceRuntime,
  type HoidExactClaimPackage,
  type HoidExactClaimSelector,
  type HoidExactUnitEvidenceRuntime,
} from "./exactUnitEvidenceRuntime";
import { isHoidKnowledgeKind } from "./knowledgeKinds";
import { HoidUnitProgressCoordinator } from "./unitProgressCoordinator";
import { sha256Hex } from "./sha256";

export type HoidExactUnitClaimReviewSignature = Readonly<{
  schemaVersion: 2;
  algorithm: "Ed25519";
  keyId: string;
  signatureHex: string;
}>;

export type HoidSignedExactUnitClaimPackage = HoidExactClaimPackage & Readonly<{
  signature: HoidExactUnitClaimReviewSignature;
}>;

export type HoidExactUnitClaimSignatureVerification =
  | Readonly<{
      status: "verified";
      registryRevision: number;
      contextFingerprint: string;
      verifiedCount: number;
      claims: readonly Readonly<{
        claimId: string;
        reviewerId: string;
        keyId: string;
        messageFingerprint: string;
      }>[];
      packages: readonly HoidExactClaimPackage[];
    }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-context"
        | "invalid-package"
        | "duplicate-claim"
        | "invalid-signature-envelope"
        | "invalid-trust-registry"
        | "invalid-root-key"
        | "root-key-mismatch"
        | "registry-not-current"
        | "registry-lifetime-exceeded"
        | "registry-rollback"
        | "invalid-minimum-revision"
        | "registry-signature-invalid"
        | "verifier-unavailable"
        | "cryptographic-verification-failed"
        | "key-not-found"
        | "key-revoked"
        | "key-not-current"
        | "reviewer-key-mismatch"
        | "repository-not-authorized"
        | "signature-invalid";
      index?: number;
    }>;

export type HoidSignedExactUnitEvidenceRuntimeBuild =
  | Readonly<{
      status: "ready";
      runtime: HoidExactUnitEvidenceRuntime;
      verifiedClaimCount: number;
      registryRevision: number;
      contextFingerprint: string;
    }>
  | Readonly<{
      status: "blocked";
      reason:
        | "invalid-config"
        | "signature-verification-failed"
        | "runtime-unavailable";
      signatureReason?: HoidExactUnitClaimSignatureVerification extends { status: "invalid"; reason: infer R } ? R : never;
      index?: number;
    }>;

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const SHA_PATTERN = /^[a-f0-9]{64}$/u;
const COMMIT_PATTERN = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const REF_PATTERN = /^[A-Za-z0-9_./-]{1,255}$/u;
const PATH_PATTERN = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_./-]{1,240}$/u;
const MAX_PACKAGES = 512;
const MAX_EVIDENCE = 16;
const MAX_ALIASES = 64;
const MAX_SUMMARY = 4_000;
const SIGNATURE_PATTERN = /^[a-f0-9]{128}$/u;

type CanonicalContext = HoidApprovedClaimReviewSignatureContext;
type CanonicalPackage = HoidExactClaimPackage;
type CanonicalSignature = HoidExactUnitClaimReviewSignature;

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

function denseArray(value: unknown, minimum: number, maximum: number): readonly unknown[] | null {
  try {
    if (
      !Array.isArray(value) ||
      value.length < minimum ||
      value.length > maximum ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result.push(descriptor.value);
    }
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length) {
        return null;
      }
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function canonicalContext(value: unknown): CanonicalContext | null {
  const record = exactRecord(value, [
    "schemaVersion",
    "repositoryFullName",
    "pullRequestNumber",
    "baseRef",
    "baseSha",
    "headRef",
    "headSha",
    "promotionManifestPath",
    "promotionPlanFingerprint",
    "reviewBundleFingerprint",
  ]);
  if (
    !record ||
    record.schemaVersion !== 1 ||
    typeof record.repositoryFullName !== "string" ||
    !REPOSITORY_PATTERN.test(record.repositoryFullName) ||
    typeof record.pullRequestNumber !== "number" ||
    !Number.isSafeInteger(record.pullRequestNumber) ||
    record.pullRequestNumber < 1 ||
    typeof record.baseRef !== "string" ||
    !REF_PATTERN.test(record.baseRef) ||
    typeof record.headRef !== "string" ||
    !REF_PATTERN.test(record.headRef) ||
    record.baseRef === record.headRef ||
    typeof record.baseSha !== "string" ||
    !COMMIT_PATTERN.test(record.baseSha) ||
    typeof record.headSha !== "string" ||
    !COMMIT_PATTERN.test(record.headSha) ||
    record.baseSha === record.headSha ||
    typeof record.promotionManifestPath !== "string" ||
    !PATH_PATTERN.test(record.promotionManifestPath) ||
    typeof record.promotionPlanFingerprint !== "string" ||
    !SHA_PATTERN.test(record.promotionPlanFingerprint) ||
    typeof record.reviewBundleFingerprint !== "string" ||
    !SHA_PATTERN.test(record.reviewBundleFingerprint)
  ) return null;

  return Object.freeze({
    schemaVersion: 1,
    repositoryFullName: record.repositoryFullName,
    pullRequestNumber: record.pullRequestNumber,
    baseRef: record.baseRef,
    baseSha: record.baseSha,
    headRef: record.headRef,
    headSha: record.headSha,
    promotionManifestPath: record.promotionManifestPath,
    promotionPlanFingerprint: record.promotionPlanFingerprint,
    reviewBundleFingerprint: record.reviewBundleFingerprint,
  });
}

function canonicalEvidence(value: unknown): HoidExactEvidenceRecord | null {
  const record = exactRecord(value, ["id", "aliases", "kind", "provenance", "summary"]);
  if (
    !record ||
    typeof record.id !== "string" ||
    record.id !== record.id.trim() ||
    !ID_PATTERN.test(record.id) ||
    typeof record.kind !== "string" ||
    !isHoidKnowledgeKind(record.kind) ||
    record.provenance !== "verified" ||
    typeof record.summary !== "string" ||
    record.summary !== record.summary.trim() ||
    record.summary.length < 1 ||
    record.summary.length > MAX_SUMMARY ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(record.summary)
  ) return null;

  const aliasesRaw = denseArray(record.aliases, 1, MAX_ALIASES);
  if (!aliasesRaw) return null;
  const aliases: string[] = [];
  const seen = new Set<string>();
  for (const alias of aliasesRaw) {
    if (
      typeof alias !== "string" ||
      alias !== alias.trim() ||
      alias.length < 1 ||
      alias.length > 256 ||
      /[\u0000-\u001F\u007F]/u.test(alias) ||
      seen.has(alias)
    ) return null;
    seen.add(alias);
    aliases.push(alias);
  }
  aliases.sort();
  return Object.freeze({
    id: record.id,
    aliases: Object.freeze(aliases),
    kind: record.kind,
    provenance: "verified",
    summary: record.summary,
  });
}

function canonicalPackage(value: unknown): CanonicalPackage | null {
  const record = exactRecord(value, ["claim", "evidence", "policies"]);
  if (!record) return null;
  const rawEvidence = denseArray(record.evidence, 1, MAX_EVIDENCE);
  const rawPolicies = denseArray(record.policies, 1, MAX_EVIDENCE);
  if (!rawEvidence || !rawPolicies || rawEvidence.length !== rawPolicies.length) return null;

  const evidence: HoidExactEvidenceRecord[] = [];
  const evidenceById = new Map<string, HoidExactEvidenceRecord>();
  for (const raw of rawEvidence) {
    const item = canonicalEvidence(raw);
    if (!item || evidenceById.has(item.id)) return null;
    evidenceById.set(item.id, item);
    evidence.push(item);
  }
  evidence.sort((left, right) => left.id.localeCompare(right.id));

  const policies: HoidExactUnitEvidencePolicy[] = [];
  const policyById = new Map<string, HoidExactUnitEvidencePolicy>();
  for (const raw of rawPolicies) {
    const policy = canonicalizeHoidExactUnitEvidencePolicy(raw);
    if (!policy || policyById.has(policy.evidenceId)) return null;
    policyById.set(policy.evidenceId, policy);
    policies.push(policy);
  }
  policies.sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));

  const validation = validateHoidExactApprovedClaimAttestation(record.claim, evidence, policies);
  if (validation.status !== "valid") return null;
  const claim = validation.claim;
  if (
    claim.evidenceIds.length !== evidenceById.size ||
    claim.evidenceIds.length !== policyById.size ||
    !claim.evidenceIds.every(id => evidenceById.has(id) && policyById.has(id))
  ) return null;

  return Object.freeze({
    claim,
    evidence: Object.freeze(evidence),
    policies: Object.freeze(policies),
  });
}

function canonicalSignature(value: unknown): CanonicalSignature | null {
  const record = exactRecord(value, ["schemaVersion", "algorithm", "keyId", "signatureHex"]);
  if (
    !record ||
    record.schemaVersion !== 2 ||
    record.algorithm !== "Ed25519" ||
    typeof record.keyId !== "string" ||
    !ID_PATTERN.test(record.keyId) ||
    typeof record.signatureHex !== "string" ||
    !SIGNATURE_PATTERN.test(record.signatureHex)
  ) return null;
  return Object.freeze({
    schemaVersion: 2,
    algorithm: "Ed25519",
    keyId: record.keyId,
    signatureHex: record.signatureHex,
  });
}

function signingMessage(
  claim: HoidExactApprovedClaim,
  context: CanonicalContext,
  keyId: string,
): string {
  return JSON.stringify([
    "hoid-exact-unit-approved-claim-review-ed25519-v2",
    context.repositoryFullName,
    context.pullRequestNumber,
    context.baseRef,
    context.baseSha,
    context.headRef,
    context.headSha,
    context.promotionManifestPath,
    context.promotionPlanFingerprint,
    context.reviewBundleFingerprint,
    keyId,
    claim.id,
    claim.text,
    claim.intent,
    [...claim.evidenceIds],
    claim.entityIds ? [...claim.entityIds] : [],
    claim.integrity.schemaVersion,
    claim.integrity.claimSha256,
    claim.integrity.evidenceSha256,
    claim.integrity.reviewSha256,
    claim.review.schemaVersion,
    claim.review.status,
    claim.review.origin,
    claim.review.reviewerId,
    claim.review.reviewedAt,
    claim.review.claimSha256,
    claim.review.evidenceSha256,
  ]);
}

/**
 * Build the domain-separated message an offline or hardware-backed reviewer
 * must sign. The exact claim attestation binds evidence summaries, aliases,
 * verified source-document digests and all three edition-bound unit references.
 */
export function buildHoidExactUnitClaimReviewSigningMessage(
  packageInput: unknown,
  contextInput: unknown,
  keyIdInput: unknown,
): string | null {
  const item = canonicalPackage(packageInput);
  const context = canonicalContext(contextInput);
  if (
    !item ||
    !context ||
    typeof keyIdInput !== "string" ||
    !ID_PATTERN.test(keyIdInput)
  ) return null;
  return signingMessage(item.claim, context, keyIdInput);
}

function invalid(
  reason: Extract<HoidExactUnitClaimSignatureVerification, { status: "invalid" }>["reason"],
  index?: number,
): HoidExactUnitClaimSignatureVerification {
  return Object.freeze({
    status: "invalid",
    reason,
    ...(index === undefined ? {} : { index }),
  });
}

/**
 * Verify exact-unit claim packages against the root-authenticated reviewer
 * registry. Hash attestations are checked first; Ed25519 reviewer signatures
 * then authenticate the exact claim/evidence/policy bundle and promotion context.
 */
export async function verifyHoidExactUnitClaimSignatures(
  packagesInput: unknown,
  contextInput: unknown,
  registryInput: unknown,
  rootKeyInput: unknown,
  verifierInput: unknown,
  nowInput: unknown,
  minimumRevisionInput: unknown,
): Promise<HoidExactUnitClaimSignatureVerification> {
  const context = canonicalContext(contextInput);
  if (!context) return invalid("invalid-context");
  const rawPackages = denseArray(packagesInput, 1, MAX_PACKAGES);
  if (!rawPackages) return invalid("invalid-package");

  const packages: CanonicalPackage[] = [];
  const requests: Array<{
    repositoryFullName: string;
    reviewerId: string;
    reviewedAt: string;
    keyId: string;
    message: string;
    signatureHex: string;
  }> = [];
  const claimIds = new Set<string>();
  const claimMetadata: Array<Readonly<{ claimId: string; reviewerId: string; keyId: string }>> = [];

  for (let index = 0; index < rawPackages.length; index += 1) {
    const raw = exactRecord(rawPackages[index], ["claim", "evidence", "policies", "signature"]);
    if (!raw) return invalid("invalid-package", index);
    const item = canonicalPackage({
      claim: raw.claim,
      evidence: raw.evidence,
      policies: raw.policies,
    });
    const signature = canonicalSignature(raw.signature);
    if (!item) return invalid("invalid-package", index);
    if (!signature) return invalid("invalid-signature-envelope", index);
    if (claimIds.has(item.claim.id)) return invalid("duplicate-claim", index);
    claimIds.add(item.claim.id);

    const message = signingMessage(item.claim, context, signature.keyId);
    requests.push(Object.freeze({
      repositoryFullName: context.repositoryFullName,
      reviewerId: item.claim.review.reviewerId,
      reviewedAt: item.claim.review.reviewedAt,
      keyId: signature.keyId,
      message,
      signatureHex: signature.signatureHex,
    }));
    packages.push(item);
    claimMetadata.push(Object.freeze({
      claimId: item.claim.id,
      reviewerId: item.claim.review.reviewerId,
      keyId: signature.keyId,
    }));
  }

  let verification: HoidReviewerBoundPayloadSignatureBatchVerification;
  try {
    verification = await verifyHoidReviewerBoundPayloadSignatures(
      requests,
      registryInput,
      rootKeyInput as HoidReviewerTrustRootKey,
      verifierInput as HoidEd25519VerificationPort,
      nowInput,
      minimumRevisionInput,
    );
  } catch {
    return invalid("cryptographic-verification-failed");
  }
  if (verification.status !== "verified") {
    return invalid(verification.reason, verification.index);
  }

  const contextFingerprint = sha256Hex(JSON.stringify(context));
  return Object.freeze({
    status: "verified",
    registryRevision: verification.registryRevision,
    contextFingerprint,
    verifiedCount: verification.verifiedCount,
    claims: Object.freeze(claimMetadata.map((item, index) => Object.freeze({
      ...item,
      messageFingerprint: verification.messageFingerprints[index],
    }))),
    packages: Object.freeze(packages),
  });
}

export type HoidSignedExactUnitEvidenceRuntimeConfig = Readonly<{
  coordinator: HoidUnitProgressCoordinator;
  signedPackages: readonly HoidSignedExactUnitClaimPackage[];
  context: HoidApprovedClaimReviewSignatureContext;
  trustRegistry: HoidReviewerTrustRegistry;
  rootKey: HoidReviewerTrustRootKey;
  verifier: HoidEd25519VerificationPort;
  now: string;
  minimumRegistryRevision: number;
  selector?: HoidExactClaimSelector | null;
  providerTimeoutMs?: number;
}>;

/**
 * Production-oriented factory. It refuses to construct the exact-unit runtime
 * until every package has a valid reviewer signature under the pinned trust
 * registry. The low-level runtime factory remains available for isolated tests
 * and explicitly local-only editorial workflows.
 */
export async function createHoidSignedExactUnitEvidenceRuntime(
  configInput: unknown,
): Promise<HoidSignedExactUnitEvidenceRuntimeBuild> {
  const config = exactRecord(
    configInput,
    [
      "coordinator",
      "signedPackages",
      "context",
      "trustRegistry",
      "rootKey",
      "verifier",
      "now",
      "minimumRegistryRevision",
      "selector",
      "providerTimeoutMs",
    ],
    [
      "coordinator",
      "signedPackages",
      "context",
      "trustRegistry",
      "rootKey",
      "verifier",
      "now",
      "minimumRegistryRevision",
    ],
  );
  if (
    !config ||
    !(config.coordinator instanceof HoidUnitProgressCoordinator)
  ) return Object.freeze({ status: "blocked", reason: "invalid-config" });

  const verified = await verifyHoidExactUnitClaimSignatures(
    config.signedPackages,
    config.context,
    config.trustRegistry,
    config.rootKey,
    config.verifier,
    config.now,
    config.minimumRegistryRevision,
  );
  if (verified.status !== "verified") {
    return Object.freeze({
      status: "blocked",
      reason: "signature-verification-failed",
      signatureReason: verified.reason,
      ...(verified.index === undefined ? {} : { index: verified.index }),
    });
  }

  const runtime = createHoidExactUnitEvidenceRuntime({
    coordinator: config.coordinator,
    packages: verified.packages,
    selector: (config.selector ?? null) as HoidExactClaimSelector | null,
    ...(config.providerTimeoutMs === undefined ? {} : { providerTimeoutMs: config.providerTimeoutMs }),
  });
  if (!runtime) return Object.freeze({ status: "blocked", reason: "runtime-unavailable" });

  return Object.freeze({
    status: "ready",
    runtime,
    verifiedClaimCount: verified.verifiedCount,
    registryRevision: verified.registryRevision,
    contextFingerprint: verified.contextFingerprint,
  });
}
