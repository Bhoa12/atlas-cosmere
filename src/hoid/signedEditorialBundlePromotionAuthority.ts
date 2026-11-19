import {
  authorizeHoidEditorialBundlePromotion,
  buildHoidEditorialBundlePromotionPlan,
  validateHoidEditorialBundlePromotionPlan,
  type HoidEditorialBundlePromotionAuthorization,
  type HoidEditorialBundlePromotionContext,
  type HoidEditorialBundlePromotionPlan,
} from "./editorialBundlePromotionAuthority";
import {
  validateHoidEditorialReviewBundleReceipts,
  type HoidEditorialReviewCategory,
  type HoidEditorialReviewPacketReference,
} from "./editorialReviewBundle";
import {
  verifyHoidReviewerBoundPayloadSignatures,
  type HoidEd25519VerificationPort,
  type HoidReviewerTrustRegistry,
  type HoidReviewerTrustRootKey,
  type HoidReviewerBoundPayloadSignatureRequest,
} from "./editorialReviewSignatures";
import type {
  HoidPromotionReviewRequest,
  HoidPromotionProgressPort,
  HoidSourceControlReviewPort,
} from "./promotionReviewAuthority";
import { sha256Hex } from "./sha256";

const CONTEXT_KEYS = new Set(["reviewManifest", "knowledgeManifest", "source", "receipts"]);
const REQUEST_KEYS = new Set([
  "schemaVersion", "repositoryFullName", "pullRequestNumber", "expectedBaseRef",
  "expectedHeadRef", "expectedHeadSha", "promotionManifestPath", "minimumApprovals",
  "requireCodeOwnerReview", "requireDismissStaleReviews", "requireEnforcedAdmins",
]);
const RECEIPT_BATCH_KEYS = new Set([
  "schemaVersion", "reviewBundleFingerprint", "summaries", "claims", "entities", "relationships",
]);
const SIGNATURE_BATCH_KEYS = new Set([
  "schemaVersion", "reviewBundleFingerprint", "promotionPlanFingerprint",
  "receiptsFingerprint", "signatures",
]);
const SIGNATURE_KEYS = new Set(["category", "packetId", "keyId", "signatureHex"]);
const PACKET_KEYS = new Set(["category", "draftId", "packetId", "contentSha256"]);
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,126}$/i;
const SHA_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const REF_PATTERN = /^[A-Za-z0-9_./-]{1,255}$/;
const PATH_PATTERN = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_./-]{1,240}$/;
const MAX_PACKETS = 2_048;
const SIGNATURE_TIMEOUT_MS = 15_000;

type ReceiptMetadata = Readonly<{
  packetId: string;
  draftId: string;
  decision: "approved";
  reviewerId: string;
  reviewedAt: string;
  receiptSha256: string;
}>;

export type HoidEditorialPacketSignature = Readonly<{
  category: HoidEditorialReviewCategory;
  packetId: string;
  keyId: string;
  signatureHex: string;
}>;

export type HoidEditorialBundleSignatureBatch = Readonly<{
  schemaVersion: 1;
  reviewBundleFingerprint: string;
  promotionPlanFingerprint: string;
  receiptsFingerprint: string;
  signatures: readonly HoidEditorialPacketSignature[];
}>;

export type HoidSignedEditorialBundlePromotionAuthorization =
  | (Extract<HoidEditorialBundlePromotionAuthorization, { status: "ready-for-maintainer-commit" }> & Readonly<{
      verifiedReceiptCount: number;
      trustRegistryRevision: number;
      signatureBatchFingerprint: string;
    }>)
  | Extract<HoidEditorialBundlePromotionAuthorization, { status: "blocked" }>
  | Readonly<{
      status: "blocked";
      reason:
        | "invalid-signature-batch"
        | "signature-verification-failed"
        | "signature-verification-timeout"
        | "invalid-progress-snapshot";
      verificationReason?: string;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>;

function canonicalRecord(value: unknown, allowedKeys: ReadonlySet<string>): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== allowedKeys.size) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !allowedKeys.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) {
        return null;
      }
      result[key] = descriptor.value;
    }
    for (const key of allowedKeys) if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    return result;
  } catch {
    return null;
  }
}

function canonicalDenseArray(value: unknown, maximum: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || value.length > maximum || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) {
        return null;
      }
      result.push(descriptor.value);
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function canonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  try {
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
  } catch {
    return false;
  }
}

function canonicalRequest(value: unknown): HoidPromotionReviewRequest | null {
  const raw = canonicalRecord(value, REQUEST_KEYS);
  if (
    !raw ||
    raw.schemaVersion !== 1 ||
    typeof raw.repositoryFullName !== "string" || !REPOSITORY_PATTERN.test(raw.repositoryFullName) ||
    !Number.isSafeInteger(raw.pullRequestNumber) || (raw.pullRequestNumber as number) < 1 ||
    typeof raw.expectedBaseRef !== "string" || !REF_PATTERN.test(raw.expectedBaseRef) ||
    typeof raw.expectedHeadRef !== "string" || !REF_PATTERN.test(raw.expectedHeadRef) ||
    raw.expectedBaseRef === raw.expectedHeadRef ||
    typeof raw.expectedHeadSha !== "string" || !COMMIT_PATTERN.test(raw.expectedHeadSha) ||
    typeof raw.promotionManifestPath !== "string" || !PATH_PATTERN.test(raw.promotionManifestPath) ||
    !Number.isSafeInteger(raw.minimumApprovals) || (raw.minimumApprovals as number) < 1 ||
    (raw.minimumApprovals as number) > 5 ||
    typeof raw.requireCodeOwnerReview !== "boolean" ||
    typeof raw.requireDismissStaleReviews !== "boolean" ||
    typeof raw.requireEnforcedAdmins !== "boolean"
  ) return null;
  return Object.freeze({
    schemaVersion: 1,
    repositoryFullName: raw.repositoryFullName,
    pullRequestNumber: raw.pullRequestNumber as number,
    expectedBaseRef: raw.expectedBaseRef,
    expectedHeadRef: raw.expectedHeadRef,
    expectedHeadSha: raw.expectedHeadSha,
    promotionManifestPath: raw.promotionManifestPath,
    minimumApprovals: raw.minimumApprovals as number,
    requireCodeOwnerReview: raw.requireCodeOwnerReview,
    requireDismissStaleReviews: raw.requireDismissStaleReviews,
    requireEnforcedAdmins: raw.requireEnforcedAdmins,
  });
}

function canonicalContext(value: unknown): HoidEditorialBundlePromotionContext | null {
  const raw = canonicalRecord(value, CONTEXT_KEYS);
  if (!raw) return null;
  return Object.freeze({
    reviewManifest: raw.reviewManifest,
    knowledgeManifest: raw.knowledgeManifest,
    source: raw.source,
    receipts: raw.receipts,
  });
}

function canonicalPacketReference(value: unknown): HoidEditorialReviewPacketReference | null {
  const raw = canonicalRecord(value, PACKET_KEYS);
  if (
    !raw ||
    !(raw.category === "summary" || raw.category === "atomic-claim" ||
      raw.category === "entity" || raw.category === "relationship") ||
    typeof raw.draftId !== "string" || !ID_PATTERN.test(raw.draftId) ||
    typeof raw.packetId !== "string" ||
    !(raw.category === "summary" ? /^review:[a-f0-9]{64}$/.test(raw.packetId) : SHA_PATTERN.test(raw.packetId)) ||
    typeof raw.contentSha256 !== "string" || !SHA_PATTERN.test(raw.contentSha256)
  ) return null;
  return Object.freeze({
    category: raw.category as HoidEditorialReviewCategory,
    draftId: raw.draftId,
    packetId: raw.packetId,
    contentSha256: raw.contentSha256,
  });
}

function canonicalSignature(value: unknown): HoidEditorialPacketSignature | null {
  const raw = canonicalRecord(value, SIGNATURE_KEYS);
  if (
    !raw ||
    !(raw.category === "summary" || raw.category === "atomic-claim" ||
      raw.category === "entity" || raw.category === "relationship") ||
    typeof raw.packetId !== "string" ||
    typeof raw.keyId !== "string" || !ID_PATTERN.test(raw.keyId) ||
    typeof raw.signatureHex !== "string" || !/^[a-f0-9]{128}$/.test(raw.signatureHex)
  ) return null;
  return Object.freeze({
    category: raw.category as HoidEditorialReviewCategory,
    packetId: raw.packetId,
    keyId: raw.keyId,
    signatureHex: raw.signatureHex,
  });
}

type JsonState = { nodes: number };

function stableJson(value: unknown, state: JsonState, depth: number): string | null {
  state.nodes += 1;
  if (state.nodes > 512 || depth > 8) return null;
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isSafeInteger(value) ? String(value) : null;
  if (Array.isArray(value)) {
    try {
      if (Object.getPrototypeOf(value) !== Array.prototype || value.length > 64) return null;
      const keys = Reflect.ownKeys(value);
      if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
      const parts: string[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) return null;
        const item = stableJson(descriptor.value, state, depth + 1);
        if (item === null) return null;
        parts.push(item);
      }
      return "[" + parts.join(",") + "]";
    } catch {
      return null;
    }
  }
  if (typeof value === "object") {
    try {
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) return null;
      const keys = Reflect.ownKeys(value);
      if (keys.length > 32 || keys.some(key => typeof key !== "string")) return null;
      const sorted = (keys as string[]).sort();
      const parts: string[] = [];
      for (const key of sorted) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) return null;
        const item = stableJson(descriptor.value, state, depth + 1);
        if (item === null) return null;
        parts.push(JSON.stringify(key) + ":" + item);
      }
      return "{" + parts.join(",") + "}";
    } catch {
      return null;
    }
  }
  return null;
}

function ownString(value: unknown, key: string): string | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor &&
      Object.prototype.hasOwnProperty.call(descriptor, "value") &&
      descriptor.enumerable === true &&
      typeof descriptor.value === "string"
      ? descriptor.value
      : null;
  } catch {
    return null;
  }
}

function receiptMetadata(value: unknown): ReceiptMetadata | null {
  const packetId = ownString(value, "packetId");
  const draftId = ownString(value, "draftId");
  const decision = ownString(value, "decision");
  const reviewerId = ownString(value, "reviewerId");
  const reviewedAt = ownString(value, "reviewedAt");
  if (
    !packetId || !ID_PATTERN.test(draftId ?? "") ||
    decision !== "approved" ||
    !reviewerId || !ID_PATTERN.test(reviewerId) ||
    !canonicalTimestamp(reviewedAt)
  ) return null;
  const serialized = stableJson(value, { nodes: 0 }, 0);
  if (serialized === null || serialized.length > 16_384) return null;
  return Object.freeze({
    packetId,
    draftId: draftId as string,
    decision: "approved",
    reviewerId,
    reviewedAt,
    receiptSha256: sha256Hex(serialized),
  });
}

function receiptContentSha256(category: HoidEditorialReviewCategory, receipt: unknown): string | null {
  switch (category) {
    case "summary": return ownString(receipt, "summarySha256");
    case "atomic-claim": return ownString(receipt, "claimSha256");
    case "entity": return ownString(receipt, "draftSha256");
    case "relationship": return ownString(receipt, "claimSha256");
  }
}

/**
 * Build the domain-separated payload an offline/hardware-backed reviewer signs.
 * The receipt digest covers every checklist field and note code; the packet
 * reference binds the reviewed content and source packet.
 */
export function buildHoidEditorialReviewPacketSigningMessage(
  packetInput: unknown,
  receiptInput: unknown,
  planInput: unknown,
  requestInput: unknown,
  keyIdInput: unknown,
): string | null {
  const packet = canonicalPacketReference(packetInput);
  const planValidation = validateHoidEditorialBundlePromotionPlan(planInput);
  const request = canonicalRequest(requestInput);
  const metadata = receiptMetadata(receiptInput);
  if (
    !packet ||
    planValidation.status !== "valid" ||
    !request ||
    !metadata ||
    typeof keyIdInput !== "string" || !ID_PATTERN.test(keyIdInput) ||
    metadata.packetId !== packet.packetId ||
    metadata.draftId !== packet.draftId ||
    receiptContentSha256(packet.category, receiptInput) !== packet.contentSha256 ||
    !planValidation.plan.packets.some(item =>
      item.category === packet.category &&
      item.draftId === packet.draftId &&
      item.packetId === packet.packetId &&
      item.contentSha256 === packet.contentSha256
    )
  ) return null;

  return JSON.stringify([
    "hoid-editorial-review-packet-receipt-ed25519-v1",
    request.repositoryFullName,
    request.pullRequestNumber,
    request.expectedBaseRef,
    request.expectedHeadRef,
    request.expectedHeadSha,
    request.promotionManifestPath,
    planValidation.plan.fingerprint,
    planValidation.plan.reviewBundleFingerprint,
    planValidation.plan.knowledgeBundleFingerprint,
    planValidation.plan.receiptsFingerprint,
    planValidation.plan.progressRevision,
    planValidation.plan.progressFingerprint,
    packet.category,
    packet.draftId,
    packet.packetId,
    packet.contentSha256,
    metadata.receiptSha256,
    metadata.reviewerId,
    metadata.reviewedAt,
    metadata.decision,
    keyIdInput,
  ]);
}

function receiptArrayKey(category: HoidEditorialReviewCategory): "summaries" | "claims" | "entities" | "relationships" {
  switch (category) {
    case "summary": return "summaries";
    case "atomic-claim": return "claims";
    case "entity": return "entities";
    case "relationship": return "relationships";
  }
}

function buildReceiptMap(value: unknown): ReadonlyMap<string, unknown> | null {
  const raw = canonicalRecord(value, RECEIPT_BATCH_KEYS);
  if (!raw || raw.schemaVersion !== 1 || typeof raw.reviewBundleFingerprint !== "string" ||
      !SHA_PATTERN.test(raw.reviewBundleFingerprint)) return null;
  const map = new Map<string, unknown>();
  for (const category of ["summary", "atomic-claim", "entity", "relationship"] as const) {
    const array = canonicalDenseArray(raw[receiptArrayKey(category)], MAX_PACKETS);
    if (!array) return null;
    for (const receipt of array) {
      const packetId = ownString(receipt, "packetId");
      if (!packetId) return null;
      const key = category + ":" + packetId;
      if (map.has(key)) return null;
      map.set(key, receipt);
    }
  }
  return map;
}

function signatureBatchFingerprint(batch: HoidEditorialBundleSignatureBatch): string {
  return sha256Hex(JSON.stringify([
    "hoid-editorial-bundle-signature-batch-v1",
    batch.reviewBundleFingerprint,
    batch.promotionPlanFingerprint,
    batch.receiptsFingerprint,
    batch.signatures.map(item => [item.category, item.packetId, item.keyId, item.signatureHex]),
  ]));
}

function canonicalSignatureBatch(value: unknown): HoidEditorialBundleSignatureBatch | null {
  const raw = canonicalRecord(value, SIGNATURE_BATCH_KEYS);
  if (
    !raw ||
    raw.schemaVersion !== 1 ||
    typeof raw.reviewBundleFingerprint !== "string" || !SHA_PATTERN.test(raw.reviewBundleFingerprint) ||
    typeof raw.promotionPlanFingerprint !== "string" || !SHA_PATTERN.test(raw.promotionPlanFingerprint) ||
    typeof raw.receiptsFingerprint !== "string" || !SHA_PATTERN.test(raw.receiptsFingerprint)
  ) return null;
  const rawSignatures = canonicalDenseArray(raw.signatures, MAX_PACKETS);
  if (!rawSignatures) return null;
  const signatures: HoidEditorialPacketSignature[] = [];
  for (const item of rawSignatures) {
    const signature = canonicalSignature(item);
    if (!signature) return null;
    signatures.push(signature);
  }
  return Object.freeze({
    schemaVersion: 1,
    reviewBundleFingerprint: raw.reviewBundleFingerprint,
    promotionPlanFingerprint: raw.promotionPlanFingerprint,
    receiptsFingerprint: raw.receiptsFingerprint,
    signatures: Object.freeze(signatures),
  });
}

function blocked(
  reason: Extract<HoidSignedEditorialBundlePromotionAuthorization, { status: "blocked" }>["reason"],
  verificationReason?: string,
): HoidSignedEditorialBundlePromotionAuthorization {
  return Object.freeze({
    status: "blocked",
    reason,
    ...(verificationReason ? { verificationReason } : {}),
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

type VerificationOutcome =
  | Readonly<{ status: "value"; value: Awaited<ReturnType<typeof verifyHoidReviewerBoundPayloadSignatures>> }>
  | Readonly<{ status: "timeout" }>
  | Readonly<{ status: "error" }>;

async function verifyWithTimeout(
  call: () => Promise<Awaited<ReturnType<typeof verifyHoidReviewerBoundPayloadSignatures>>>,
): Promise<VerificationOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const work = Promise.resolve().then(call).then<VerificationOutcome, VerificationOutcome>(
    value => Object.freeze({ status: "value", value }),
    () => Object.freeze({ status: "error" }),
  );
  const timeout = new Promise<VerificationOutcome>(resolve => {
    timer = setTimeout(() => resolve(Object.freeze({ status: "timeout" })), SIGNATURE_TIMEOUT_MS);
  });
  const result = await Promise.race([work, timeout]);
  if (timer !== undefined) clearTimeout(timer);
  return result;
}

/**
 * Verifies one signature for every approved packet receipt before delegating
 * to the existing protected GitHub/SQLite promotion authority. It never
 * writes production or merges a pull request.
 */
export async function authorizeHoidSignedEditorialBundlePromotion(
  planInput: unknown,
  contextInput: unknown,
  requestInput: unknown,
  signatureBatchInput: unknown,
  trustRegistryInput: HoidReviewerTrustRegistry,
  trustRootKeyInput: HoidReviewerTrustRootKey,
  verifierInput: HoidEd25519VerificationPort,
  nowInput: unknown,
  minimumRegistryRevisionInput: unknown,
  progressSnapshotInput: unknown,
  sourceControlPortInput: HoidSourceControlReviewPort,
  progressPortInput: HoidPromotionProgressPort,
): Promise<HoidSignedEditorialBundlePromotionAuthorization> {
  const planValidation = validateHoidEditorialBundlePromotionPlan(planInput);
  if (planValidation.status !== "valid") return blocked("invalid-plan");
  const plan: HoidEditorialBundlePromotionPlan = planValidation.plan;
  const context = canonicalContext(contextInput);
  if (!context) return blocked("invalid-editorial-context");
  const request = canonicalRequest(requestInput);
  if (!request) return blocked("invalid-request");

  const rebuilt = buildHoidEditorialBundlePromotionPlan(
    context.reviewManifest,
    context.knowledgeManifest,
    context.source,
    context.receipts,
    progressSnapshotInput,
  );
  if (rebuilt.status === "invalid") return blocked("editorial-bundle-invalid");
  if (rebuilt.status === "blocked") {
    return blocked(rebuilt.reason === "invalid-progress" ? "invalid-progress-snapshot" : rebuilt.reason);
  }
  if (rebuilt.plan.fingerprint !== plan.fingerprint) return blocked("editorial-bundle-changed");

  const receiptValidation = validateHoidEditorialReviewBundleReceipts(
    context.reviewManifest,
    context.knowledgeManifest,
    context.source,
    context.receipts,
  );
  if (receiptValidation.status !== "complete") {
    return blocked(
      receiptValidation.status === "needs-revision"
        ? "editorial-review-needs-revision"
        : receiptValidation.status === "incomplete"
          ? "editorial-review-incomplete"
          : "editorial-bundle-invalid",
    );
  }

  const batch = canonicalSignatureBatch(signatureBatchInput);
  if (
    !batch ||
    batch.signatures.length !== plan.packetCount ||
    batch.reviewBundleFingerprint !== plan.reviewBundleFingerprint ||
    batch.promotionPlanFingerprint !== plan.fingerprint ||
    batch.receiptsFingerprint !== plan.receiptsFingerprint
  ) return blocked("invalid-signature-batch");

  const receipts = buildReceiptMap(context.receipts);
  if (!receipts) return blocked("editorial-bundle-invalid");
  const signatureRequests: HoidReviewerBoundPayloadSignatureRequest[] = [];
  for (let index = 0; index < plan.packets.length; index += 1) {
    const packet = plan.packets[index];
    const signature = batch.signatures[index];
    if (
      signature.category !== packet.category ||
      signature.packetId !== packet.packetId
    ) return blocked("invalid-signature-batch");

    const receipt = receipts.get(packet.category + ":" + packet.packetId);
    if (receipt === undefined) return blocked("editorial-bundle-invalid");
    const metadata = receiptMetadata(receipt);
    const message = buildHoidEditorialReviewPacketSigningMessage(
      packet,
      receipt,
      plan,
      request,
      signature.keyId,
    );
    if (!metadata || message === null) return blocked("editorial-bundle-invalid");
    signatureRequests.push(Object.freeze({
      repositoryFullName: request.repositoryFullName,
      reviewerId: metadata.reviewerId,
      reviewedAt: metadata.reviewedAt,
      keyId: signature.keyId,
      message,
      signatureHex: signature.signatureHex,
    }));
  }

  const verification = await verifyWithTimeout(() => verifyHoidReviewerBoundPayloadSignatures(
    signatureRequests,
    trustRegistryInput,
    trustRootKeyInput,
    verifierInput,
    nowInput,
    minimumRegistryRevisionInput,
  ));
  if (verification.status === "timeout") return blocked("signature-verification-timeout");
  if (verification.status === "error") return blocked("signature-verification-failed", "verifier-error");
  if (verification.value.status !== "verified") {
    return blocked("signature-verification-failed", verification.value.reason +
      (verification.value.index === undefined ? "" : ":index=" + verification.value.index));
  }

  const authorization = await authorizeHoidEditorialBundlePromotion(
    plan,
    context,
    request,
    sourceControlPortInput,
    progressPortInput,
  );
  if (authorization.status !== "ready-for-maintainer-commit") return authorization;

  return Object.freeze({
    ...authorization,
    verifiedReceiptCount: verification.value.verifiedCount,
    trustRegistryRevision: verification.value.registryRevision,
    signatureBatchFingerprint: signatureBatchFingerprint(batch),
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}
