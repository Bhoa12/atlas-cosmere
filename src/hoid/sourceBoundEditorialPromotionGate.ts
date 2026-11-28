import { HOID_EDITORIAL_DRAFTS } from "./editorialDrafts";
import {
  buildHoidEditorialReviewPackets,
  fingerprintHoidEditorialReviewDecision,
  validateHoidEditorialReviewReceipt,
} from "./editorialReviewPackets";
import {
  validateHoidEditorialBundlePromotionPlan,
  type HoidEditorialBundlePromotionPlan,
} from "./editorialBundlePromotionAuthority";
import {
  authorizeHoidTrustedHostSignedEditorialBundlePromotion,
  type HoidTrustedHostPromotionInput,
  type HoidTrustedHostPromotionResult,
} from "./trustedHostPromotionAuthority";
import type { HoidEditorialSummaryPromotionPreflightPort } from "./editorialSummaryPromotionPreflight";
import { sha256Hex } from "./sha256";

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const COMMIT_PATTERN = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u;
const MAX_SUMMARY_PACKETS = 512;
const CONTEXT_KEYS = ["reviewManifest", "knowledgeManifest", "source", "receipts"] as const;
const RECEIPT_BATCH_KEYS = [
  "schemaVersion", "reviewBundleFingerprint", "summaries", "claims", "entities", "relationships",
] as const;
const PREFLIGHT_RESULT_KEYS = [
  "status", "packetId", "draftId", "workId", "chapterNumber", "editionId",
  "progressRevision", "receiptFingerprint", "reviewDecisionFingerprint",
  "sourceDocumentVerified", "reviewerIdentity", "promotionAllowed",
  "productionWritePerformed", "answerAuthorizationEffect", "spoilerUnlockEffect",
] as const;

export type HoidTrustedHostPromotionAuthorityPort = Readonly<{
  authorize(input: HoidTrustedHostPromotionInput): Promise<HoidTrustedHostPromotionResult>;
}>;

export type HoidSourceBoundEditorialPromotionGateResult =
  | Readonly<{
      status: "ready-for-maintainer-commit";
      planFingerprint: string;
      reviewBundleFingerprint: string;
      receiptsFingerprint: string;
      sourcePreflightFingerprint: string;
      summaryPacketCount: number;
      verifiedSourceCount: number;
      progressRevision: number;
      verifiedReceiptCount: number;
      verifiedReviewerCount: number;
      trustRegistryRevision: number;
      minimumRegistryRevision: number;
      signatureBatchFingerprint: string;
      baseSha: string;
      headSha: string;
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
        | "invalid-plan"
        | "no-summary-packets"
        | "source-preflight-unavailable"
        | "source-preflight-blocked"
        | "source-preflight-invalid"
        | "source-preflight-inconsistent"
        | "source-preflight-changed"
        | "trusted-host-authority-unavailable"
        | "trusted-host-authority-failed"
        | "trusted-host-authorization-blocked"
        | "trusted-host-result-invalid";
      promotionAllowed: false;
      productionWritePerformed: false;
      answerAuthorizationEffect: "none";
      spoilerUnlockEffect: "none";
    }>;

export type HoidSourceBoundEditorialPromotionGatePort = Readonly<{
  authorize(input: HoidTrustedHostPromotionInput): Promise<HoidSourceBoundEditorialPromotionGateResult>;
}>;

type SummaryReceiptBindings = ReadonlyMap<string, string>;
type PreflightPass =
  | Readonly<{ status: "ready"; fingerprint: string; receiptFingerprint: string }>
  | Readonly<{
      status: "blocked";
      reason:
        | "source-preflight-unavailable"
        | "source-preflight-blocked"
        | "source-preflight-invalid"
        | "source-preflight-inconsistent";
    }>;

type TrustedAuthorizationMetadata = Readonly<{
  verifiedReceiptCount: number;
  verifiedReviewerCount: number;
  trustRegistryRevision: number;
  minimumRegistryRevision: number;
  signatureBatchFingerprint: string;
}>;

function blocked(
  reason: Extract<HoidSourceBoundEditorialPromotionGateResult, { status: "blocked" }>["reason"],
): Extract<HoidSourceBoundEditorialPromotionGateResult, { status: "blocked" }> {
  return Object.freeze({
    status: "blocked",
    reason,
    promotionAllowed: false,
    productionWritePerformed: false,
    answerAuthorizationEffect: "none",
    spoilerUnlockEffect: "none",
  });
}

function plainRecord(value: unknown): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function hasOnlyDataProperties(value: unknown): boolean {
  const record = plainRecord(value);
  if (!record) return false;
  try {
    for (const key of Reflect.ownKeys(record)) {
      if (typeof key !== "string") return false;
      const descriptor = Object.getOwnPropertyDescriptor(record, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function ownDataValue(value: unknown, key: string): unknown {
  try {
    if (plainRecord(value) === null) return undefined;
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

function exactRecord(value: unknown, allowedKeys: readonly string[]): Record<string, unknown> | null {
  const record = plainRecord(value);
  if (!record) return null;
  try {
    const keys = Reflect.ownKeys(record);
    if (
      keys.length !== allowedKeys.length ||
      keys.some(key => typeof key !== "string" || !allowedKeys.includes(key))
    ) return null;
    const output = Object.create(null) as Record<string, unknown>;
    for (const key of allowedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(record, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      output[key] = descriptor.value;
    }
    return output;
  } catch {
    return null;
  }
}

function denseValues(value: unknown, maximum: number): readonly unknown[] | null {
  try {
    if (
      !Array.isArray(value) ||
      value.length > maximum ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) return null;
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

function safeMethod<TInput>(
  value: unknown,
  name: string,
): ((input: TInput) => Promise<unknown>) | null {
  try {
    if (plainRecord(value) === null) return null;
    let current: object | null = value as object;
    for (let depth = 0; current !== null && current !== Object.prototype && depth < 4; depth += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(current, name);
      if (descriptor) {
        if (
          !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          typeof descriptor.value !== "function"
        ) return null;
        return (descriptor.value as (input: TInput) => Promise<unknown>).bind(value);
      }
      current = Object.getPrototypeOf(current) as object | null;
    }
    return null;
  } catch {
    return null;
  }
}

function summaryReceiptBindings(
  input: HoidTrustedHostPromotionInput,
  plan: HoidEditorialBundlePromotionPlan,
): SummaryReceiptBindings | null {
  const context = exactRecord(ownDataValue(input, "context"), CONTEXT_KEYS);
  if (!context) return null;
  const receipts = exactRecord(context.receipts, RECEIPT_BATCH_KEYS);
  if (
    !receipts ||
    receipts.schemaVersion !== 1 ||
    receipts.reviewBundleFingerprint !== plan.reviewBundleFingerprint
  ) return null;

  const summaryReceipts = denseValues(receipts.summaries, MAX_SUMMARY_PACKETS);
  if (!summaryReceipts) return null;
  const packetBuild = buildHoidEditorialReviewPackets(HOID_EDITORIAL_DRAFTS);
  if (packetBuild.status !== "ready") return null;
  const packetsById = new Map(packetBuild.packets.map(packet => [packet.packetId, packet]));
  const expected = plan.packets.filter(packet => packet.category === "summary");
  if (
    expected.length === 0 ||
    expected.length > MAX_SUMMARY_PACKETS ||
    summaryReceipts.length !== expected.length
  ) return null;

  const receiptsById = new Map<string, unknown>();
  for (const receipt of summaryReceipts) {
    const packetId = ownDataValue(receipt, "packetId");
    if (typeof packetId !== "string" || receiptsById.has(packetId)) return null;
    receiptsById.set(packetId, receipt);
  }

  const bindings = new Map<string, string>();
  for (const reference of expected) {
    const packet = packetsById.get(reference.packetId);
    const rawReceipt = receiptsById.get(reference.packetId);
    if (
      !packet ||
      packet.draftId !== reference.draftId ||
      packet.summarySha256 !== reference.contentSha256 ||
      rawReceipt === undefined
    ) return null;

    const validation = validateHoidEditorialReviewReceipt(packet, rawReceipt);
    if (
      validation.status !== "valid" ||
      validation.outcome !== "approved-awaiting-source-promotion"
    ) return null;
    bindings.set(
      reference.packetId,
      fingerprintHoidEditorialReviewDecision(validation.receipt),
    );
  }
  return bindings.size === expected.length ? bindings : null;
}

function canonicalPreflightResult(
  value: unknown,
  packetId: string,
  draftId: string,
  workId: string,
  chapterNumber: number,
  editionId: string,
  progressRevision: number,
  expectedDecisionFingerprint: string,
): Readonly<{ receiptFingerprint: string; reviewDecisionFingerprint: string }> | null {
  const raw = exactRecord(value, PREFLIGHT_RESULT_KEYS);
  if (
    !raw ||
    raw.status !== "ready-for-authenticated-review" ||
    raw.packetId !== packetId ||
    raw.draftId !== draftId ||
    raw.workId !== workId ||
    raw.chapterNumber !== chapterNumber ||
    raw.editionId !== editionId ||
    raw.progressRevision !== progressRevision ||
    typeof raw.receiptFingerprint !== "string" ||
    !SHA256_PATTERN.test(raw.receiptFingerprint) ||
    typeof raw.reviewDecisionFingerprint !== "string" ||
    !SHA256_PATTERN.test(raw.reviewDecisionFingerprint) ||
    raw.reviewDecisionFingerprint !== expectedDecisionFingerprint ||
    raw.sourceDocumentVerified !== true ||
    raw.reviewerIdentity !== "unverified-local" ||
    raw.promotionAllowed !== false ||
    raw.productionWritePerformed !== false ||
    raw.answerAuthorizationEffect !== "none" ||
    raw.spoilerUnlockEffect !== "none"
  ) return null;
  return Object.freeze({
    receiptFingerprint: raw.receiptFingerprint,
    reviewDecisionFingerprint: raw.reviewDecisionFingerprint,
  });
}

async function runPreflightPass(
  plan: HoidEditorialBundlePromotionPlan,
  bindings: SummaryReceiptBindings,
  audit: (input: unknown) => Promise<unknown>,
): Promise<PreflightPass> {
  const summaryPackets = plan.packets.filter(packet => packet.category === "summary");
  if (summaryPackets.length === 0) {
    return Object.freeze({ status: "blocked", reason: "source-preflight-invalid" });
  }
  const packetBuild = buildHoidEditorialReviewPackets(HOID_EDITORIAL_DRAFTS);
  if (packetBuild.status !== "ready") {
    return Object.freeze({ status: "blocked", reason: "source-preflight-invalid" });
  }
  const packetsById = new Map(packetBuild.packets.map(packet => [packet.packetId, packet]));
  const records: unknown[][] = [];
  let snapshotFingerprint: string | null = null;

  for (const reference of summaryPackets) {
    const packet = packetsById.get(reference.packetId);
    const draft = HOID_EDITORIAL_DRAFTS.find(item => item.id === reference.draftId);
    const decisionFingerprint = bindings.get(reference.packetId);
    if (
      !packet ||
      !draft ||
      packet.draftId !== reference.draftId ||
      packet.summarySha256 !== reference.contentSha256 ||
      !decisionFingerprint
    ) return Object.freeze({ status: "blocked", reason: "source-preflight-invalid" });

    let result: unknown;
    try {
      result = await audit(Object.freeze({ packetId: reference.packetId }));
    } catch {
      return Object.freeze({ status: "blocked", reason: "source-preflight-unavailable" });
    }
    if (ownDataValue(result, "status") === "blocked") {
      return Object.freeze({ status: "blocked", reason: "source-preflight-blocked" });
    }

    const verified = canonicalPreflightResult(
      result,
      reference.packetId,
      reference.draftId,
      draft.evidenceSource.bookId,
      draft.evidenceSource.chapter,
      draft.sourceIntegrity.editionId,
      plan.progressRevision,
      decisionFingerprint,
    );
    if (!verified) {
      return Object.freeze({ status: "blocked", reason: "source-preflight-invalid" });
    }
    if (snapshotFingerprint !== null && snapshotFingerprint !== verified.receiptFingerprint) {
      return Object.freeze({ status: "blocked", reason: "source-preflight-inconsistent" });
    }
    snapshotFingerprint = verified.receiptFingerprint;
    records.push([
      reference.packetId,
      reference.draftId,
      draft.evidenceSource.bookId,
      draft.evidenceSource.chapter,
      draft.sourceIntegrity.editionId,
      verified.receiptFingerprint,
      verified.reviewDecisionFingerprint,
    ]);
  }

  if (snapshotFingerprint === null) {
    return Object.freeze({ status: "blocked", reason: "source-preflight-invalid" });
  }
  return Object.freeze({
    status: "ready",
    receiptFingerprint: snapshotFingerprint,
    fingerprint: sha256Hex(JSON.stringify([
      "hoid-source-bound-editorial-promotion-preflight-v1",
      plan.fingerprint,
      plan.progressRevision,
      plan.receiptsFingerprint,
      snapshotFingerprint,
      records,
    ])),
  });
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

function trustedAuthorizationMetadata(
  value: unknown,
  plan: HoidEditorialBundlePromotionPlan,
  expectedBaseSha: string,
  expectedHeadSha: string,
): TrustedAuthorizationMetadata | "blocked" | null {
  if (ownDataValue(value, "status") === "blocked") return "blocked";
  if (
    ownDataValue(value, "status") !== "ready-for-maintainer-commit" ||
    ownDataValue(value, "promotionAllowed") !== false ||
    ownDataValue(value, "productionWritePerformed") !== false
  ) return null;

  const bootstrapFingerprint = ownDataValue(value, "bootstrapFingerprint");
  const configuredMinimum = ownDataValue(value, "configuredMinimumRegistryRevision");
  const persistedMinimum = ownDataValue(value, "persistedMinimumRegistryRevision");
  const revisionBound = ownDataValue(value, "authorization");
  if (
    typeof bootstrapFingerprint !== "string" ||
    !SHA256_PATTERN.test(bootstrapFingerprint) ||
    !positiveInteger(configuredMinimum) ||
    !positiveInteger(persistedMinimum) ||
    persistedMinimum < configuredMinimum ||
    ownDataValue(revisionBound, "status") !== "ready-for-maintainer-commit" ||
    ownDataValue(revisionBound, "minimumRevisionPersisted") !== true ||
    ownDataValue(revisionBound, "promotionAllowed") !== false ||
    ownDataValue(revisionBound, "productionWritePerformed") !== false
  ) return null;

  const trustRegistryRevision = ownDataValue(revisionBound, "trustRegistryRevision");
  const minimumRegistryRevision = ownDataValue(revisionBound, "minimumRegistryRevision");
  const signedAuthorization = ownDataValue(revisionBound, "authorization");
  if (
    !positiveInteger(trustRegistryRevision) ||
    !positiveInteger(minimumRegistryRevision) ||
    minimumRegistryRevision !== persistedMinimum ||
    trustRegistryRevision < minimumRegistryRevision ||
    ownDataValue(signedAuthorization, "status") !== "ready-for-maintainer-commit" ||
    ownDataValue(signedAuthorization, "baseSha") !== expectedBaseSha ||
    ownDataValue(signedAuthorization, "headSha") !== expectedHeadSha ||
    ownDataValue(signedAuthorization, "promotionPlanFingerprint") !== plan.fingerprint ||
    ownDataValue(signedAuthorization, "reviewBundleFingerprint") !== plan.reviewBundleFingerprint ||
    ownDataValue(signedAuthorization, "receiptsFingerprint") !== plan.receiptsFingerprint ||
    ownDataValue(signedAuthorization, "protectedReviewVerified") !== true ||
    ownDataValue(signedAuthorization, "editorialReviewComplete") !== true ||
    ownDataValue(signedAuthorization, "promotionAllowed") !== false ||
    ownDataValue(signedAuthorization, "productionWritePerformed") !== false ||
    ownDataValue(signedAuthorization, "verifiedReceiptCount") !== plan.packetCount ||
    ownDataValue(signedAuthorization, "trustRegistryRevision") !== trustRegistryRevision
  ) return null;

  const verifiedReceiptCount = ownDataValue(signedAuthorization, "verifiedReceiptCount");
  const signatureBatchFingerprint = ownDataValue(signedAuthorization, "signatureBatchFingerprint");
  if (
    typeof verifiedReceiptCount !== "number" ||
    !Number.isSafeInteger(verifiedReceiptCount) ||
    verifiedReceiptCount !== plan.packetCount ||
    typeof signatureBatchFingerprint !== "string" ||
    !SHA256_PATTERN.test(signatureBatchFingerprint)
  ) return null;

  const quorum = ownDataValue(value, "bundleReviewQuorum");
  const verifiedReviewerCount = ownDataValue(quorum, "verifiedReviewerCount");
  if (
    ownDataValue(quorum, "status") !== "verified" ||
    ownDataValue(quorum, "reviewBundleFingerprint") !== plan.reviewBundleFingerprint ||
    ownDataValue(quorum, "promotionPlanFingerprint") !== plan.fingerprint ||
    ownDataValue(quorum, "progressRevision") !== plan.progressRevision ||
    typeof verifiedReviewerCount !== "number" ||
    !Number.isSafeInteger(verifiedReviewerCount) ||
    verifiedReviewerCount < 2 ||
    verifiedReviewerCount > 8 ||
    ownDataValue(quorum, "promotionAllowed") !== false ||
    ownDataValue(quorum, "productionWritePerformed") !== false
  ) return null;

  return Object.freeze({
    verifiedReceiptCount,
    verifiedReviewerCount,
    trustRegistryRevision,
    minimumRegistryRevision,
    signatureBatchFingerprint,
  });
}

/** Adapter for the existing trusted-host Ed25519, revision-store, quorum and protected-GitHub authority. */
export function createHoidTrustedHostPromotionAuthorityAdapter():
HoidTrustedHostPromotionAuthorityPort {
  return Object.freeze({
    authorize: (input: HoidTrustedHostPromotionInput) =>
      authorizeHoidTrustedHostSignedEditorialBundlePromotion(input),
  });
}

/**
 * Composes edition-bound source preflights with the existing trusted-host
 * promotion authority. Every summary packet in the supplied plan is checked
 * before and after the signed authority runs. The local and authenticated
 * receipts must describe the same packet, source digest, decision and checklist;
 * reviewer identity and timestamp may differ because local receipts are not
 * authenticated identities.
 *
 * The result is only readiness for a maintainer commit. This port never writes
 * production knowledge, merges a PR, authorizes an answer or unlocks spoilers.
 */
export function createHoidSourceBoundEditorialPromotionGatePort(options: Readonly<{
  sourcePreflightPort: HoidEditorialSummaryPromotionPreflightPort;
  trustedHostAuthority: HoidTrustedHostPromotionAuthorityPort;
}>): HoidSourceBoundEditorialPromotionGatePort {
  const audit = safeMethod<unknown>(options.sourcePreflightPort, "audit");
  const authorizeTrustedHost = safeMethod<HoidTrustedHostPromotionInput>(
    options.trustedHostAuthority,
    "authorize",
  );

  return Object.freeze({
    async authorize(
      input: HoidTrustedHostPromotionInput,
    ): Promise<HoidSourceBoundEditorialPromotionGateResult> {
      if (!hasOnlyDataProperties(input)) return blocked("invalid-input");
      if (!audit) return blocked("source-preflight-unavailable");
      if (!authorizeTrustedHost) return blocked("trusted-host-authority-unavailable");

      const planInput = ownDataValue(input, "plan");
      const planValidation = validateHoidEditorialBundlePromotionPlan(planInput);
      if (planValidation.status !== "valid") return blocked("invalid-plan");
      const plan = planValidation.plan;
      const summaryCount = plan.packets.filter(packet => packet.category === "summary").length;
      if (summaryCount === 0) return blocked("no-summary-packets");

      const request = ownDataValue(input, "request");
      if (!hasOnlyDataProperties(request)) return blocked("invalid-input");
      const expectedBaseSha = ownDataValue(request, "expectedBaseSha");
      const expectedHeadSha = ownDataValue(request, "expectedHeadSha");
      if (
        typeof expectedBaseSha !== "string" ||
        !COMMIT_PATTERN.test(expectedBaseSha) ||
        typeof expectedHeadSha !== "string" ||
        !COMMIT_PATTERN.test(expectedHeadSha)
      ) return blocked("invalid-input");

      const bindings = summaryReceiptBindings(input, plan);
      if (!bindings || bindings.size !== summaryCount) return blocked("invalid-input");

      const firstPass = await runPreflightPass(plan, bindings, audit);
      if (firstPass.status !== "ready") return blocked(firstPass.reason);

      let authorityResult: unknown;
      try {
        authorityResult = await authorizeTrustedHost(input);
      } catch {
        return blocked("trusted-host-authority-failed");
      }
      const authorization = trustedAuthorizationMetadata(
        authorityResult,
        plan,
        expectedBaseSha,
        expectedHeadSha,
      );
      if (authorization === "blocked") return blocked("trusted-host-authorization-blocked");
      if (!authorization) return blocked("trusted-host-result-invalid");

      const secondPass = await runPreflightPass(plan, bindings, audit);
      if (secondPass.status !== "ready") return blocked(secondPass.reason);
      if (
        firstPass.fingerprint !== secondPass.fingerprint ||
        firstPass.receiptFingerprint !== secondPass.receiptFingerprint
      ) return blocked("source-preflight-changed");

      return Object.freeze({
        status: "ready-for-maintainer-commit",
        planFingerprint: plan.fingerprint,
        reviewBundleFingerprint: plan.reviewBundleFingerprint,
        receiptsFingerprint: plan.receiptsFingerprint,
        sourcePreflightFingerprint: firstPass.fingerprint,
        summaryPacketCount: summaryCount,
        verifiedSourceCount: summaryCount,
        progressRevision: plan.progressRevision,
        verifiedReceiptCount: authorization.verifiedReceiptCount,
        verifiedReviewerCount: authorization.verifiedReviewerCount,
        trustRegistryRevision: authorization.trustRegistryRevision,
        minimumRegistryRevision: authorization.minimumRegistryRevision,
        signatureBatchFingerprint: authorization.signatureBatchFingerprint,
        baseSha: expectedBaseSha,
        headSha: expectedHeadSha,
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
