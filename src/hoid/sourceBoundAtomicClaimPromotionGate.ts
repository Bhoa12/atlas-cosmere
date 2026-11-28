import {
  auditHoidEditorialClaimPromotionPreflight,
  createHoidTrustedHostClaimPromotionAdapter,
  type HoidEditorialClaimPromotionPreflightResult,
  type HoidTrustedHostClaimPromotionResult,
} from "./editorialClaimPromotionPreflight";
import {
  validateHoidEditorialReviewKit,
  type HoidEditorialReviewKit,
} from "./editorialReviewKit";
import {
  authorizeHoidTrustedHostSignedEditorialBundlePromotion,
  type HoidTrustedHostPromotionInput,
  type HoidTrustedHostPromotionResult,
} from "./trustedHostPromotionAuthority";
import type { HoidEditorialSourceDocumentAccessPort } from "./editorialSourceDocumentAccess";
import { sha256Hex } from "./sha256";

const OUTER_KEYS = ["trustedHostInput", "reviewKit", "claimBindings"] as const;
const HOST_REQUIRED_KEYS = ["plan", "context", "request", "expectedRepositoryFullName"] as const;
const HOST_ALLOWED_KEYS = new Set([
  ...HOST_REQUIRED_KEYS,
  "signatureBatch",
  "trustRegistry",
  "verifier",
  "now",
  "revisionStore",
  "progressSnapshot",
  "sourceControlPort",
  "progressPort",
  "bootstrapPort",
  "bundleReviewAttestations",
]);
const HOST_PORT_KEYS = new Set([
  "verifier",
  "revisionStore",
  "sourceControlPort",
  "progressPort",
  "bootstrapPort",
]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

export type HoidSourceBoundAtomicClaimPromotionResult =
  | Readonly<{
      status: "ready-for-maintainer-commit";
      reviewKitFingerprint: string;
      promotionPlanFingerprint: string;
      preflightFingerprint: string;
      atomicClaimCount: number;
      sourceDocumentsVerified: number;
      assertionKindCounts: Readonly<Record<string, number>>;
      sourceInspectionPasses: 2;
      sourceContentIncluded: false;
      providerEgress: "none";
      promotionAllowed: false;
      productionWritePerformed: false;
      answerAuthorizationEffect: "none";
      spoilerUnlockEffect: "none";
    }>
  | Readonly<{
      status: "blocked";
      reason:
        | "invalid-input"
        | "invalid-review-kit"
        | "input-changed"
        | "preflight-blocked"
        | "preflight-inconsistent"
        | "trusted-host-blocked"
        | "trusted-host-failed";
      promotionAllowed: false;
      productionWritePerformed: false;
      answerAuthorizationEffect: "none";
      spoilerUnlockEffect: "none";
    }>;

export type HoidSourceBoundAtomicClaimPromotionGatePort = Readonly<{
  authorize(input: unknown): Promise<HoidSourceBoundAtomicClaimPromotionResult>;
}>;

export type HoidSourceBoundAtomicClaimPromotionGateOptions = Readonly<{
  sourceAccessPort: HoidEditorialSourceDocumentAccessPort;
  trustedHostAuthority: (
    input: HoidTrustedHostPromotionInput,
  ) => Promise<HoidTrustedHostPromotionResult>;
}>;

type InputSnapshot = Readonly<{
  reviewKitFingerprint: string;
  promotionPlanFingerprint: string;
  bindingsFingerprint: string;
  trustedHostDataFingerprint: string;
  trustedHostPorts: readonly Readonly<{ key: string; value: unknown }>[];
}>;

function blocked(
  reason: Extract<HoidSourceBoundAtomicClaimPromotionResult, { status: "blocked" }>["reason"],
): HoidSourceBoundAtomicClaimPromotionResult {
  return Object.freeze({
    status: "blocked",
    reason,
    promotionAllowed: false,
    productionWritePerformed: false,
    answerAuthorizationEffect: "none",
    spoilerUnlockEffect: "none",
  });
}

function ownDataValue(value: unknown, key: string): unknown {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      !descriptor ||
      !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
      descriptor.enumerable !== true
    ) return undefined;
    return descriptor.value;
  } catch {
    return undefined;
  }
}

function exactRecord(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> | null {
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

/** Accept only inert JSON data; never invoke getters, toJSON hooks or custom iterators. */
function isPlainJsonData(
  value: unknown,
  depth = 0,
  ancestors: Set<object> = new Set(),
): boolean {
  if (depth > 64) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || ancestors.has(value)) return false;

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) return false;
      const keys = Reflect.ownKeys(value);
      if (keys.length !== value.length + 1 || !keys.includes("length")) return false;
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (
          !descriptor ||
          !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          descriptor.enumerable !== true ||
          !isPlainJsonData(descriptor.value, depth + 1, ancestors)
        ) return false;
      }
      for (const key of keys) {
        if (key === "length") continue;
        if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length) {
          return false;
        }
      }
      return true;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") return false;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true ||
        !isPlainJsonData(descriptor.value, depth + 1, ancestors)
      ) return false;
    }
    return true;
  } catch {
    return false;
  } finally {
    ancestors.delete(value);
  }
}

function jsonFingerprint(value: unknown): string | null {
  if (!isPlainJsonData(value)) return null;
  try {
    const serialized = JSON.stringify(value);
    return typeof serialized === "string" ? sha256Hex(serialized) : null;
  } catch {
    return null;
  }
}

function captureTrustedHostSnapshot(value: unknown): Readonly<{
  fingerprint: string;
  ports: readonly Readonly<{ key: string; value: unknown }>[];
}> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const keys = Reflect.ownKeys(value);
    if (
      keys.length < HOST_REQUIRED_KEYS.length ||
      keys.some(key => typeof key !== "string" || !HOST_ALLOWED_KEYS.has(key))
    ) return null;

    const data: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    const ports: { key: string; value: unknown }[] = [];
    for (const key of keys) {
      if (typeof key !== "string") return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      const field = descriptor.value;
      if (HOST_PORT_KEYS.has(key)) {
        if ((typeof field !== "object" && typeof field !== "function") || field === null) return null;
        ports.push(Object.freeze({ key, value: field }));
      } else {
        if (!isPlainJsonData(field)) return null;
        data[key] = field;
      }
    }
    if (HOST_REQUIRED_KEYS.some(key => !Object.prototype.hasOwnProperty.call(data, key))) return null;
    if (typeof data.expectedRepositoryFullName !== "string") return null;

    const fingerprint = jsonFingerprint(data);
    if (!fingerprint) return null;
    return Object.freeze({
      fingerprint,
      ports: Object.freeze(ports),
    });
  } catch {
    return null;
  }
}

function captureInputSnapshot(input: unknown): Readonly<{
  canonical: Readonly<{
    trustedHostInput: HoidTrustedHostPromotionInput;
    reviewKit: HoidEditorialReviewKit;
    claimBindings: readonly unknown[];
  }>;
  snapshot: InputSnapshot;
}> | null {
  const raw = exactRecord(input, OUTER_KEYS);
  if (!raw) return null;

  const kitValidation = validateHoidEditorialReviewKit(raw.reviewKit);
  if (kitValidation.status !== "valid") return null;
  const kit = kitValidation.kit;
  const bindingsFingerprint = jsonFingerprint(raw.claimBindings);
  const hostSnapshot = captureTrustedHostSnapshot(raw.trustedHostInput);
  if (!bindingsFingerprint || !hostSnapshot) return null;

  const canonical = Object.freeze({
    trustedHostInput: raw.trustedHostInput as HoidTrustedHostPromotionInput,
    reviewKit: kit,
    claimBindings: raw.claimBindings as readonly unknown[],
  });
  return Object.freeze({
    canonical,
    snapshot: Object.freeze({
      reviewKitFingerprint: kit.fingerprint,
      promotionPlanFingerprint: kit.promotionPlan.fingerprint,
      bindingsFingerprint,
      trustedHostDataFingerprint: hostSnapshot.fingerprint,
      trustedHostPorts: hostSnapshot.ports,
    }),
  });
}

function sameSnapshot(left: InputSnapshot, right: InputSnapshot): boolean {
  return left.reviewKitFingerprint === right.reviewKitFingerprint &&
    left.promotionPlanFingerprint === right.promotionPlanFingerprint &&
    left.bindingsFingerprint === right.bindingsFingerprint &&
    left.trustedHostDataFingerprint === right.trustedHostDataFingerprint &&
    left.trustedHostPorts.length === right.trustedHostPorts.length &&
    left.trustedHostPorts.every((item, index) =>
      item.key === right.trustedHostPorts[index]?.key &&
      item.value === right.trustedHostPorts[index]?.value
    );
}

function sameAudit(
  left: HoidEditorialClaimPromotionPreflightResult,
  right: HoidEditorialClaimPromotionPreflightResult,
): boolean {
  const leftFingerprint = jsonFingerprint(left);
  const rightFingerprint = jsonFingerprint(right);
  return leftFingerprint !== null && leftFingerprint === rightFingerprint;
}

/**
 * Composes the existing atomic-claim parity adapter with a second, post-authority
 * source inspection. The first audit occurs before the signed trusted-host
 * authority; the second revalidates every claim/source binding after it returns.
 *
 * The gate never writes production knowledge, merges a PR, authorizes an answer,
 * changes reading progress or unlocks spoilers. Its successful result is only
 * readiness for a maintainer commit.
 */
export function createHoidSourceBoundAtomicClaimPromotionGatePort(
  options: HoidSourceBoundAtomicClaimPromotionGateOptions,
): HoidSourceBoundAtomicClaimPromotionGatePort {
  const delegate = createHoidTrustedHostClaimPromotionAdapter(
    options.sourceAccessPort,
    options.trustedHostAuthority,
  );

  return Object.freeze({
    async authorize(input: unknown): Promise<HoidSourceBoundAtomicClaimPromotionResult> {
      const before = captureInputSnapshot(input);
      if (!before) {
        const raw = exactRecord(input, OUTER_KEYS);
        return blocked(raw ? "invalid-review-kit" : "invalid-input");
      }

      let delegated: HoidTrustedHostClaimPromotionResult;
      try {
        delegated = await delegate.authorize(before.canonical);
      } catch {
        return blocked("trusted-host-failed");
      }

      if (delegated.status !== "ready-for-maintainer-commit") {
        return blocked(
          delegated.reason === "trusted-host-blocked" ||
          delegated.reason === "trusted-host-context-mismatch"
            ? "trusted-host-blocked"
            : delegated.reason === "trusted-host-failed"
              ? "trusted-host-failed"
              : "preflight-blocked",
        );
      }

      const after = captureInputSnapshot(before.canonical);
      if (!after || !sameSnapshot(before.snapshot, after.snapshot)) {
        return blocked("input-changed");
      }

      const postflight = await auditHoidEditorialClaimPromotionPreflight(
        after.canonical.reviewKit,
        after.canonical.claimBindings,
        options.sourceAccessPort,
      );
      if (postflight.status !== "ready-for-trusted-host") {
        return blocked("preflight-blocked");
      }
      if (!sameAudit(delegated.parityAudit, postflight)) {
        return blocked("preflight-inconsistent");
      }

      const preflightFingerprint = sha256Hex(JSON.stringify([
        "hoid-source-bound-atomic-claim-promotion-v1",
        before.snapshot.reviewKitFingerprint,
        before.snapshot.promotionPlanFingerprint,
        before.snapshot.bindingsFingerprint,
        before.snapshot.trustedHostDataFingerprint,
        jsonFingerprint(delegated.parityAudit),
        jsonFingerprint(postflight),
        2,
      ]));

      if (!SHA256_PATTERN.test(preflightFingerprint)) return blocked("preflight-inconsistent");

      return Object.freeze({
        status: "ready-for-maintainer-commit",
        reviewKitFingerprint: postflight.reviewKitFingerprint,
        promotionPlanFingerprint: postflight.promotionPlanFingerprint,
        preflightFingerprint,
        atomicClaimCount: postflight.atomicClaimCount,
        sourceDocumentsVerified: postflight.sourceDocumentsVerified,
        assertionKindCounts: postflight.assertionKindCounts,
        sourceInspectionPasses: 2,
        sourceContentIncluded: false,
        providerEgress: "none",
        promotionAllowed: false,
        productionWritePerformed: false,
        answerAuthorizationEffect: "none",
        spoilerUnlockEffect: "none",
      });
    },
  });
}

/** Production composition delegates to the existing pinned-root Ed25519 host authority. */
export function createProductionHoidSourceBoundAtomicClaimPromotionGatePort(
  sourceAccessPort: HoidEditorialSourceDocumentAccessPort,
): HoidSourceBoundAtomicClaimPromotionGatePort {
  return createHoidSourceBoundAtomicClaimPromotionGatePort({
    sourceAccessPort,
    trustedHostAuthority: authorizeHoidTrustedHostSignedEditorialBundlePromotion,
  });
}
