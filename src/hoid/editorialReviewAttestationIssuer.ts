import {
  buildHoidEditorialBundleReviewSigningMessageFromPlan,
  type HoidEditorialBundleReviewAttestation,
  type HoidEditorialBundleReviewDecision,
  type HoidEditorialBundleReviewContext,
} from "./editorialReviewBundleQuorum";
import type { HoidEditorialBundlePromotionPlan } from "./editorialBundlePromotionAuthority";
import { sha256Hex } from "./sha256";

const INPUT_KEYS = Object.freeze([
  "plan", "context", "reviewerId", "decision", "reviewedAt", "keyId", "signer",
] as const);
const SIGNER_KEYS = Object.freeze(["sign"] as const);
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,126}$/iu;
const SIGNATURE_PATTERN = /^[a-f0-9]{128}$/u;

export type HoidEditorialAttestationSignerPort = Readonly<{
  /** Returns a 64-byte Ed25519 signature encoded as 128 lowercase hex characters. */
  sign(message: string): Promise<string>;
}>;

export type HoidEditorialAttestationIssueResult =
  | Readonly<{
      status: "issued-unverified";
      attestation: HoidEditorialBundleReviewAttestation;
      signingMessageSha256: string;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "blocked";
      reason: "signer-failed";
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "invalid";
      reason: "invalid-input" | "invalid-signer" | "invalid-review-context" | "invalid-signature";
      promotionAllowed: false;
      productionWritePerformed: false;
    }>;

function exactDataRecord(value: unknown, allowedKeys: readonly string[]): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== allowedKeys.length ||
        keys.some(key => typeof key !== "string" || !allowedKeys.includes(key))) return null;
    const output = Object.create(null) as Record<string, unknown>;
    for (const key of allowedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          descriptor.enumerable !== true) return null;
      output[key] = descriptor.value;
    }
    return output;
  } catch { return null; }
}

/**
 * Issue a bundle-review attestation through an injected signing provider.
 * The provider owns key custody (for example, a hardware-backed platform key).
 * This module creates no key material and does not decide whether the key is
 * trusted. The result is deliberately "issued-unverified": the trusted host
 * must later verify it against the root-authenticated reviewer registry and
 * rebuild the promotion plan against live progress.
 */
export async function issueHoidEditorialBundleReviewAttestation(
  input: unknown,
): Promise<HoidEditorialAttestationIssueResult> {
  const raw = exactDataRecord(input, INPUT_KEYS);
  if (!raw ||
      typeof raw.reviewerId !== "string" || !ID_PATTERN.test(raw.reviewerId) ||
      (raw.decision !== "approve" && raw.decision !== "reject") ||
      typeof raw.reviewedAt !== "string" ||
      typeof raw.keyId !== "string" || !ID_PATTERN.test(raw.keyId)) {
    return Object.freeze({
      status: "invalid", reason: "invalid-input",
      promotionAllowed: false, productionWritePerformed: false,
    });
  }

  const signer = exactDataRecord(raw.signer, SIGNER_KEYS);
  if (!signer || typeof signer.sign !== "function") {
    return Object.freeze({
      status: "invalid", reason: "invalid-signer",
      promotionAllowed: false, productionWritePerformed: false,
    });
  }

  const message = buildHoidEditorialBundleReviewSigningMessageFromPlan(
    raw.plan as HoidEditorialBundlePromotionPlan,
    raw.context as HoidEditorialBundleReviewContext,
    raw.reviewerId,
    raw.decision as HoidEditorialBundleReviewDecision,
    raw.reviewedAt,
    raw.keyId,
  );
  if (!message) {
    return Object.freeze({
      status: "invalid", reason: "invalid-review-context",
      promotionAllowed: false, productionWritePerformed: false,
    });
  }

  const sign = signer.sign as (message: string) => Promise<unknown>;
  let signature: unknown;
  try { signature = await sign(message); }
  catch {
    return Object.freeze({
      status: "blocked", reason: "signer-failed",
      promotionAllowed: false, productionWritePerformed: false,
    });
  }
  if (typeof signature !== "string" || !SIGNATURE_PATTERN.test(signature)) {
    return Object.freeze({
      status: "invalid", reason: "invalid-signature",
      promotionAllowed: false, productionWritePerformed: false,
    });
  }

  const plan = raw.plan as HoidEditorialBundlePromotionPlan;
  const attestation: HoidEditorialBundleReviewAttestation = Object.freeze({
    schemaVersion: 1,
    reviewBundleFingerprint: plan.reviewBundleFingerprint,
    promotionPlanFingerprint: plan.fingerprint,
    reviewerId: raw.reviewerId,
    decision: raw.decision,
    reviewedAt: raw.reviewedAt,
    keyId: raw.keyId,
    signatureHex: signature,
  });
  return Object.freeze({
    status: "issued-unverified",
    attestation,
    signingMessageSha256: sha256Hex(message),
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}
