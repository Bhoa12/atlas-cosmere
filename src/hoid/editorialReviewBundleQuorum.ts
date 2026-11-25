import {
  validateHoidEditorialKnowledgeBundleManifest,
  type HoidEditorialKnowledgeBundleManifest,
} from "./editorialKnowledgeBundle";
import {
  verifyHoidReviewerBoundPayloadSignatures,
  type HoidApprovedClaimReviewSignatureContext,
  type HoidReviewerBoundPayloadSignatureRequest,
  type HoidReviewerTrustRegistry,
  type HoidReviewerTrustRootKey,
  type HoidEd25519VerificationPort,
} from "./editorialReviewSignatures";

const CONTEXT_KEYS = Object.freeze([
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
] as const);
const ATTESTATION_KEYS = Object.freeze([
  "schemaVersion",
  "bundleFingerprint",
  "reviewerId",
  "decision",
  "reviewedAt",
  "keyId",
  "signatureHex",
] as const);
const INPUT_KEYS = Object.freeze([
  "manifest",
  "sourceInput",
  "context",
  "attestations",
  "registry",
  "rootKey",
  "verifier",
  "now",
  "minimumRegistryRevision",
] as const);
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,126}$/iu;
const SHA_PATTERN = /^[a-f0-9]{64}$/u;
const SIGNATURE_PATTERN = /^[a-f0-9]{128}$/u;
const COMMIT_PATTERN = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const REF_PATTERN = /^[A-Za-z0-9_./-]{1,255}$/u;
const PATH_PATTERN = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_./-]{1,240}$/u;
const MINIMUM_REVIEWERS = 2;
const MAXIMUM_REVIEWERS = 8;

export type HoidEditorialBundleReviewDecision = "approve" | "reject";

export type HoidEditorialBundleReviewAttestation = Readonly<{
  schemaVersion: 1;
  bundleFingerprint: string;
  reviewerId: string;
  decision: HoidEditorialBundleReviewDecision;
  reviewedAt: string;
  keyId: string;
  signatureHex: string;
}>;

export type HoidEditorialBundleReviewContext = HoidApprovedClaimReviewSignatureContext;

export type HoidEditorialBundleReviewQuorumResult =
  | Readonly<{
      status: "verified";
      bundleFingerprint: string;
      registryRevision: number;
      verifiedReviewerCount: number;
      reviewerIds: readonly string[];
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "rejected";
      bundleFingerprint: string;
      registryRevision: number;
      verifiedReviewerCount: number;
      reviewerIds: readonly string[];
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "blocked";
      reason: "bundle-blocked";
      bundleFingerprint: string;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-input"
        | "invalid-bundle"
        | "invalid-context"
        | "context-bundle-mismatch"
        | "invalid-attestations"
        | "trust-verification-failed";
      trustReason?: string;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>;

type CanonicalContext = HoidEditorialBundleReviewContext;
type CanonicalAttestation = HoidEditorialBundleReviewAttestation;

function exactDataRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[] = allowedKeys,
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.some(key => typeof key !== "string" || !allowedKeys.includes(key))) return null;
    const output = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string") return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      output[key] = descriptor.value;
    }
    if (requiredKeys.some(key => !Object.prototype.hasOwnProperty.call(output, key))) return null;
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

function canonicalIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  try {
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
  } catch {
    return false;
  }
}

function canonicalContext(
  value: unknown,
  expectedBundleFingerprint: string,
): CanonicalContext | null {
  const raw = exactDataRecord(value, CONTEXT_KEYS);
  if (
    !raw ||
    raw.schemaVersion !== 1 ||
    typeof raw.repositoryFullName !== "string" ||
    !REPOSITORY_PATTERN.test(raw.repositoryFullName) ||
    typeof raw.pullRequestNumber !== "number" ||
    !Number.isSafeInteger(raw.pullRequestNumber) ||
    raw.pullRequestNumber < 1 ||
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
    raw.reviewBundleFingerprint !== expectedBundleFingerprint
  ) return null;

  return Object.freeze({
    schemaVersion: 1,
    repositoryFullName: raw.repositoryFullName,
    pullRequestNumber: raw.pullRequestNumber,
    baseRef: raw.baseRef,
    baseSha: raw.baseSha,
    headRef: raw.headRef,
    headSha: raw.headSha,
    promotionManifestPath: raw.promotionManifestPath,
    promotionPlanFingerprint: raw.promotionPlanFingerprint,
    reviewBundleFingerprint: expectedBundleFingerprint,
  });
}

function canonicalAttestations(
  value: unknown,
  expectedBundleFingerprint: string,
): readonly CanonicalAttestation[] | null {
  const rawItems = denseValues(value, MAXIMUM_REVIEWERS);
  if (!rawItems || rawItems.length < MINIMUM_REVIEWERS) return null;

  const result: CanonicalAttestation[] = [];
  const reviewers = new Set<string>();
  const keyIds = new Set<string>();
  let previousReviewerId = "";

  for (const item of rawItems) {
    const raw = exactDataRecord(item, ATTESTATION_KEYS);
    if (
      !raw ||
      raw.schemaVersion !== 1 ||
      raw.bundleFingerprint !== expectedBundleFingerprint ||
      typeof raw.reviewerId !== "string" ||
      !ID_PATTERN.test(raw.reviewerId) ||
      (raw.decision !== "approve" && raw.decision !== "reject") ||
      !canonicalIsoTimestamp(raw.reviewedAt) ||
      typeof raw.keyId !== "string" ||
      !ID_PATTERN.test(raw.keyId) ||
      typeof raw.signatureHex !== "string" ||
      !SIGNATURE_PATTERN.test(raw.signatureHex) ||
      reviewers.has(raw.reviewerId) ||
      keyIds.has(raw.keyId) ||
      (previousReviewerId !== "" && raw.reviewerId <= previousReviewerId)
    ) return null;

    reviewers.add(raw.reviewerId);
    keyIds.add(raw.keyId);
    previousReviewerId = raw.reviewerId;
    result.push(Object.freeze({
      schemaVersion: 1,
      bundleFingerprint: expectedBundleFingerprint,
      reviewerId: raw.reviewerId,
      decision: raw.decision,
      reviewedAt: raw.reviewedAt,
      keyId: raw.keyId,
      signatureHex: raw.signatureHex,
    }));
  }

  return Object.freeze(result);
}

function validatedReviewBundle(
  manifestInput: unknown,
  sourceInput: unknown,
): Readonly<{
  status: "ready-for-review";
  manifest: HoidEditorialKnowledgeBundleManifest;
}> | Readonly<{
  status: "blocked";
  manifest: HoidEditorialKnowledgeBundleManifest;
}> | null {
  const validation = validateHoidEditorialKnowledgeBundleManifest(manifestInput, sourceInput);
  if (validation.status !== "valid") return null;
  return Object.freeze({
    status: validation.bundleStatus,
    manifest: validation.manifest,
  });
}

function signingMessage(
  context: CanonicalContext,
  bundleFingerprint: string,
  reviewerId: string,
  decision: HoidEditorialBundleReviewDecision,
  reviewedAt: string,
  keyId: string,
): string {
  return JSON.stringify([
    "hoid-editorial-knowledge-bundle-review-ed25519-v1",
    context.repositoryFullName,
    context.pullRequestNumber,
    context.baseRef,
    context.baseSha,
    context.headRef,
    context.headSha,
    context.promotionManifestPath,
    context.promotionPlanFingerprint,
    bundleFingerprint,
    reviewerId,
    decision,
    reviewedAt,
    keyId,
  ]);
}

/**
 * Build the exact domain-separated message an offline reviewer signs.
 *
 * The source drafts are revalidated against the metadata-only bundle first.
 * No draft prose or EPUB content is included in the message; only the verified
 * bundle fingerprint and the exact repository/PR/promotion context are bound.
 */
export function buildHoidEditorialBundleReviewSigningMessage(
  manifestInput: unknown,
  sourceInput: unknown,
  contextInput: unknown,
  reviewerIdInput: unknown,
  decisionInput: unknown,
  reviewedAtInput: unknown,
  keyIdInput: unknown,
): string | null {
  const bundle = validatedReviewBundle(manifestInput, sourceInput);
  if (!bundle || bundle.status !== "ready-for-review") return null;
  const context = canonicalContext(contextInput, bundle.manifest.fingerprint);
  if (
    !context ||
    typeof reviewerIdInput !== "string" ||
    !ID_PATTERN.test(reviewerIdInput) ||
    (decisionInput !== "approve" && decisionInput !== "reject") ||
    !canonicalIsoTimestamp(reviewedAtInput) ||
    typeof keyIdInput !== "string" ||
    !ID_PATTERN.test(keyIdInput)
  ) return null;

  return signingMessage(
    context,
    bundle.manifest.fingerprint,
    reviewerIdInput,
    decisionInput,
    reviewedAtInput,
    keyIdInput,
  );
}

/**
 * Verify a two-person (or stronger) editorial quorum over the complete bundle.
 *
 * Every signature binds the same metadata-only bundle fingerprint, exact PR
 * base/head, promotion plan, reviewer identity and decision. Reviewer keys are
 * authenticated by the existing root-signed registry. Duplicate reviewer IDs
 * and duplicate key IDs are rejected. A verified quorum is still not a
 * production promotion: this function never writes production knowledge.
 */
export async function verifyHoidEditorialKnowledgeBundleReviewQuorum(
  input: unknown,
): Promise<HoidEditorialBundleReviewQuorumResult> {
  const raw = exactDataRecord(input, INPUT_KEYS);
  if (!raw) {
    return Object.freeze({
      status: "invalid",
      reason: "invalid-input",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }

  const bundle = validatedReviewBundle(raw.manifest, raw.sourceInput);
  if (!bundle) {
    return Object.freeze({
      status: "invalid",
      reason: "invalid-bundle",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }
  if (bundle.status !== "ready-for-review") {
    return Object.freeze({
      status: "blocked",
      reason: "bundle-blocked",
      bundleFingerprint: bundle.manifest.fingerprint,
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }

  const context = canonicalContext(raw.context, bundle.manifest.fingerprint);
  if (!context) {
    const suppliedContext = exactDataRecord(raw.context, CONTEXT_KEYS);
    const reason = suppliedContext &&
      suppliedContext.reviewBundleFingerprint !== bundle.manifest.fingerprint
      ? "context-bundle-mismatch"
      : "invalid-context";
    return Object.freeze({
      status: "invalid",
      reason,
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }

  const attestations = canonicalAttestations(raw.attestations, bundle.manifest.fingerprint);
  if (!attestations) {
    return Object.freeze({
      status: "invalid",
      reason: "invalid-attestations",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }

  if (
    typeof raw.now !== "string" ||
    !canonicalIsoTimestamp(raw.now) ||
    typeof raw.minimumRegistryRevision !== "number" ||
    !Number.isSafeInteger(raw.minimumRegistryRevision) ||
    raw.minimumRegistryRevision < 1
  ) {
    return Object.freeze({
      status: "invalid",
      reason: "invalid-input",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }

  const requests: HoidReviewerBoundPayloadSignatureRequest[] = attestations.map(attestation => ({
    repositoryFullName: context.repositoryFullName,
    reviewerId: attestation.reviewerId,
    reviewedAt: attestation.reviewedAt,
    keyId: attestation.keyId,
    message: signingMessage(
      context,
      bundle.manifest.fingerprint,
      attestation.reviewerId,
      attestation.decision,
      attestation.reviewedAt,
      attestation.keyId,
    ),
    signatureHex: attestation.signatureHex,
  }));

  const verification = await verifyHoidReviewerBoundPayloadSignatures(
    requests,
    raw.registry as HoidReviewerTrustRegistry,
    raw.rootKey as HoidReviewerTrustRootKey,
    raw.verifier as HoidEd25519VerificationPort,
    raw.now,
    raw.minimumRegistryRevision,
  );
  if (verification.status !== "verified") {
    return Object.freeze({
      status: "invalid",
      reason: "trust-verification-failed",
      trustReason: verification.reason,
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }

  const reviewerIds = Object.freeze(attestations.map(item => item.reviewerId));
  const common = {
    bundleFingerprint: bundle.manifest.fingerprint,
    registryRevision: verification.registryRevision,
    verifiedReviewerCount: verification.verifiedCount,
    reviewerIds,
    promotionAllowed: false as const,
    productionWritePerformed: false as const,
  };

  return attestations.some(item => item.decision === "reject")
    ? Object.freeze({ status: "rejected", ...common })
    : Object.freeze({ status: "verified", ...common });
}
