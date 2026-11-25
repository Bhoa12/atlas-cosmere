import {
  buildHoidEditorialBundlePromotionPlan,
  validateHoidEditorialBundlePromotionPlan,
  type HoidEditorialBundlePromotionPlan,
} from "./editorialBundlePromotionAuthority";
import {
  buildHoidEditorialReviewBundle,
  validateHoidEditorialReviewBundleReceipts,
  type HoidEditorialReviewBundleManifest,
  type HoidEditorialReviewBundlePackets,
  type HoidEditorialReviewBundleReceipts,
} from "./editorialReviewBundle";
import {
  validateHoidEditorialKnowledgeBundleManifest,
  type HoidEditorialKnowledgeBundleManifest,
} from "./editorialKnowledgeBundle";
import {
  validateHoidEditorialBundleReviewContext,
  type HoidEditorialBundleReviewContext,
} from "./editorialReviewBundleQuorum";
import type { HoidEditorialClaimEvidence } from "./editorialClaimDrafts";
import { HOID_SOURCE_CATALOG_MANIFEST } from "./sourceCatalogManifest";
import { sha256Hex } from "./sha256";

const INPUT_KEYS = Object.freeze([
  "knowledgeManifest", "sourceInput", "receipts", "progressSnapshot", "context",
] as const);
const SOURCE_INPUT_KEYS = Object.freeze(["summaries", "claims", "entities", "relationships"] as const);
const CONTEXT_REQUEST_KEYS = Object.freeze([
  "repositoryFullName", "pullRequestNumber", "baseRef", "baseSha",
  "headRef", "headSha", "promotionManifestPath",
] as const);
const KIT_KEYS = Object.freeze([
  "schemaVersion", "kind", "catalogueFingerprint", "knowledgeManifest",
  "reviewManifest", "sourceInput", "receipts", "promotionPlan", "context",
  "packets", "spoilerScope", "progressDisclosure", "sourcePassagesIncluded",
  "privateEpubBytesIncluded", "promotionAllowed", "productionWritePerformed", "fingerprint",
] as const);
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const REF_PATTERN = /^[A-Za-z0-9_./-]{1,255}$/u;
const COMMIT_PATTERN = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u;
const PATH_PATTERN = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_./-]{1,240}$/u;
const SHA_PATTERN = /^[a-f0-9]{64}$/u;
const MAX_REVIEW_KIT_CHARACTERS = 8_000_000;

export type HoidEditorialReviewKitSourceInput = Readonly<{
  summaries: readonly unknown[];
  claims: readonly unknown[];
  entities: readonly unknown[];
  relationships: readonly unknown[];
}>;

export type HoidEditorialReviewKitContextRequest = Readonly<{
  repositoryFullName: string;
  pullRequestNumber: number;
  baseRef: string;
  baseSha: string;
  headRef: string;
  headSha: string;
  promotionManifestPath: string;
}>;

export type HoidEditorialReviewScopeEntry = Readonly<{
  packetId: string;
  category: "summary" | "atomic-claim" | "entity" | "relationship";
  draftId: string;
  evidenceIndex: number;
  source: Readonly<{
    bookId: string;
    chapter: number;
    locatorId: string;
    editionId: string;
    navigationSha256: string;
    documentSha256: string;
  }>;
  unlock: Readonly<{ bookId: string; chapter: number }>;
}>;

export type HoidEditorialReviewKit = Readonly<{
  schemaVersion: 1;
  kind: "hoid-editorial-review-kit";
  catalogueFingerprint: string;
  knowledgeManifest: HoidEditorialKnowledgeBundleManifest;
  reviewManifest: HoidEditorialReviewBundleManifest;
  sourceInput: HoidEditorialReviewKitSourceInput;
  receipts: HoidEditorialReviewBundleReceipts;
  promotionPlan: HoidEditorialBundlePromotionPlan;
  context: HoidEditorialBundleReviewContext;
  packets: HoidEditorialReviewBundlePackets;
  spoilerScope: readonly HoidEditorialReviewScopeEntry[];
  progressDisclosure: "revision-and-fingerprint-only";
  sourcePassagesIncluded: false;
  privateEpubBytesIncluded: false;
  promotionAllowed: false;
  productionWritePerformed: false;
  fingerprint: string;
}>;

export type HoidEditorialReviewKitBuildResult =
  | Readonly<{
      status: "ready";
      kit: HoidEditorialReviewKit;
      packetCount: number;
      spoilerScopeCount: number;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "blocked";
      reason: "knowledge-bundle-blocked" | "receipts-not-complete" | "progress-invalid";
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-input"
        | "knowledge-bundle-invalid"
        | "review-bundle-invalid"
        | "promotion-plan-invalid"
        | "context-invalid"
        | "review-kit-invalid"
        | "size-limit";
      promotionAllowed: false;
      productionWritePerformed: false;
    }>;

export type HoidEditorialReviewKitValidation =
  | Readonly<{
      status: "valid";
      kit: HoidEditorialReviewKit;
      packetCount: number;
      spoilerScopeCount: number;
    }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-shape"
        | "catalogue-mismatch"
        | "knowledge-bundle-invalid"
        | "review-bundle-mismatch"
        | "receipts-invalid"
        | "promotion-plan-mismatch"
        | "context-mismatch"
        | "spoiler-scope-mismatch"
        | "fingerprint-mismatch"
        | "size-limit";
    }>;

export type HoidEditorialReviewKitSerialization =
  | Readonly<{ status: "ready"; json: string; fingerprint: string }>
  | Readonly<{ status: "invalid"; reason: "invalid-kit" | "size-limit" }>;

export type HoidEditorialReviewKitParseResult =
  | HoidEditorialReviewKitValidation
  | Readonly<{ status: "invalid"; reason: "invalid-json" | "size-limit" }>;

function exactDataRecord(
  value: unknown,
  allowedKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== allowedKeys.length ||
      keys.some(key => typeof key !== "string" || !allowedKeys.includes(key))
    ) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of allowedKeys) {
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

/** Reject accessors, sparse arrays, cycles, custom prototypes and non-JSON values without invoking property getters. */
function isPlainJsonData(
  value: unknown,
  depth = 0,
  ancestors: Set<object> = new Set(),
): boolean {
  if (depth > 64) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  if (ancestors.has(value)) return false;

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

function deepFreeze<T>(value: T, seen: Set<object> = new Set()): T {
  if (value === null || typeof value !== "object") return value;
  const object = value as object;
  if (seen.has(object)) return value;
  seen.add(object);
  for (const key of Reflect.ownKeys(object)) {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, "value")) {
      deepFreeze(descriptor.value, seen);
    }
  }
  return Object.freeze(value);
}

function jsonClone(value: unknown): unknown | null {
  try {
    if (!isPlainJsonData(value)) return null;
    const serialized = JSON.stringify(value);
    if (typeof serialized !== "string" || serialized.length > MAX_REVIEW_KIT_CHARACTERS) return null;
    return deepFreeze(JSON.parse(serialized) as unknown);
  } catch {
    return null;
  }
}

function canonicalContextRequest(value: unknown): HoidEditorialReviewKitContextRequest | null {
  const raw = exactDataRecord(value, CONTEXT_REQUEST_KEYS);
  if (
    !raw ||
    typeof raw.repositoryFullName !== "string" ||
    !REPOSITORY_PATTERN.test(raw.repositoryFullName) ||
    typeof raw.pullRequestNumber !== "number" ||
    !Number.isSafeInteger(raw.pullRequestNumber) ||
    raw.pullRequestNumber < 1 ||
    typeof raw.baseRef !== "string" ||
    !REF_PATTERN.test(raw.baseRef) ||
    typeof raw.baseSha !== "string" ||
    !COMMIT_PATTERN.test(raw.baseSha) ||
    typeof raw.headRef !== "string" ||
    !REF_PATTERN.test(raw.headRef) ||
    raw.baseRef === raw.headRef ||
    typeof raw.headSha !== "string" ||
    !COMMIT_PATTERN.test(raw.headSha) ||
    raw.baseSha === raw.headSha ||
    typeof raw.promotionManifestPath !== "string" ||
    !PATH_PATTERN.test(raw.promotionManifestPath)
  ) return null;

  return Object.freeze({
    repositoryFullName: raw.repositoryFullName,
    pullRequestNumber: raw.pullRequestNumber,
    baseRef: raw.baseRef,
    baseSha: raw.baseSha,
    headRef: raw.headRef,
    headSha: raw.headSha,
    promotionManifestPath: raw.promotionManifestPath,
  });
}

function scopeEntry(
  packetId: string,
  category: HoidEditorialReviewScopeEntry["category"],
  draftId: string,
  evidenceIndex: number,
  evidence: HoidEditorialClaimEvidence,
): HoidEditorialReviewScopeEntry {
  return Object.freeze({
    packetId,
    category,
    draftId,
    evidenceIndex,
    source: Object.freeze({
      bookId: evidence.source.bookId,
      chapter: evidence.source.chapter,
      locatorId: evidence.source.locatorId,
      editionId: evidence.sourceIntegrity.editionId,
      navigationSha256: evidence.sourceIntegrity.navigationSha256,
      documentSha256: evidence.sourceIntegrity.documentSha256,
    }),
    unlock: Object.freeze({
      bookId: evidence.unlock.bookId,
      chapter: evidence.unlock.chapter,
    }),
  });
}

function compareScope(
  left: HoidEditorialReviewScopeEntry,
  right: HoidEditorialReviewScopeEntry,
): number {
  const order = { summary: 0, "atomic-claim": 1, entity: 2, relationship: 3 } as const;
  const category = order[left.category] - order[right.category];
  if (category !== 0) return category;
  if (left.draftId !== right.draftId) return left.draftId < right.draftId ? -1 : 1;
  return left.evidenceIndex - right.evidenceIndex;
}

function buildSpoilerScope(
  packets: HoidEditorialReviewBundlePackets,
): readonly HoidEditorialReviewScopeEntry[] {
  const entries: HoidEditorialReviewScopeEntry[] = [];

  for (const packet of packets.summaries) {
    entries.push(Object.freeze({
      packetId: packet.packetId,
      category: "summary",
      draftId: packet.draftId,
      evidenceIndex: 0,
      source: Object.freeze({
        bookId: packet.source.bookId,
        chapter: packet.source.chapter,
        locatorId: packet.source.locatorId,
        editionId: packet.source.editionId,
        navigationSha256: packet.source.navigationSha256,
        documentSha256: packet.sourceDocumentSha256,
      }),
      unlock: Object.freeze({
        bookId: packet.unlock.bookId,
        chapter: packet.unlock.chapter,
      }),
    }));
  }

  for (const packet of packets.claims) {
    packet.evidence.forEach((evidence, index) => {
      entries.push(scopeEntry(packet.packetId, "atomic-claim", packet.draftId, index, evidence));
    });
  }
  for (const packet of packets.entities) {
    packet.evidence.forEach((evidence, index) => {
      entries.push(scopeEntry(packet.packetId, "entity", packet.draftId, index, evidence));
    });
  }
  for (const packet of packets.relationships) {
    packet.evidence.forEach((evidence, index) => {
      entries.push(scopeEntry(packet.packetId, "relationship", packet.draftId, index, evidence));
    });
  }

  return Object.freeze(entries.sort(compareScope));
}

function reviewerIdsFromReceipts(value: unknown): readonly string[] | null {
  const raw = exactDataRecord(value, [
    "schemaVersion", "reviewBundleFingerprint", "summaries", "claims", "entities", "relationships",
  ]);
  if (!raw || raw.schemaVersion !== 1) return null;
  const ids = new Set<string>();
  for (const key of ["summaries", "claims", "entities", "relationships"] as const) {
    const batch = raw[key];
    if (!Array.isArray(batch)) return null;
    for (let index = 0; index < batch.length; index += 1) {
      const receipt = batch[index];
      if (receipt === null || typeof receipt !== "object" || Array.isArray(receipt)) return null;
      const reviewer = Object.getOwnPropertyDescriptor(receipt, "reviewerId");
      if (
        !reviewer ||
        !Object.prototype.hasOwnProperty.call(reviewer, "value") ||
        reviewer.enumerable !== true ||
        typeof reviewer.value !== "string" ||
        reviewer.value.trim() !== reviewer.value ||
        reviewer.value.length < 1 ||
        reviewer.value.length > 128
      ) return null;
      ids.add(reviewer.value);
    }
  }
  return ids.size > 0 ? Object.freeze([...ids].sort()) : null;
}

function kitFingerprint(value: Omit<HoidEditorialReviewKit, "fingerprint">): string {
  return sha256Hex(JSON.stringify([
    "hoid-editorial-review-kit-v1",
    value.schemaVersion,
    value.kind,
    value.catalogueFingerprint,
    value.knowledgeManifest,
    value.reviewManifest,
    value.sourceInput,
    value.receipts,
    value.promotionPlan,
    value.context,
    value.packets,
    value.spoilerScope,
    value.progressDisclosure,
    value.sourcePassagesIncluded,
    value.privateEpubBytesIncluded,
    value.promotionAllowed,
    value.productionWritePerformed,
  ]));
}

function invalidBuild(
  reason: Extract<HoidEditorialReviewKitBuildResult, { status: "invalid" }>["reason"],
): HoidEditorialReviewKitBuildResult {
  return Object.freeze({
    status: "invalid",
    reason,
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

/**
 * Build a portable reviewer kit from validated original editorial drafts.
 * The raw progress snapshot is consumed to build the plan but is never exported;
 * only its revision/fingerprint and per-packet unlock ceilings are included.
 */
export function buildHoidEditorialReviewKit(input: unknown): HoidEditorialReviewKitBuildResult {
  const raw = exactDataRecord(input, INPUT_KEYS);
  if (!raw || !isPlainJsonData(input)) return invalidBuild("invalid-input");

  const sourceInput = exactDataRecord(raw.sourceInput, SOURCE_INPUT_KEYS);
  const contextRequest = canonicalContextRequest(raw.context);
  if (!sourceInput || !contextRequest) return invalidBuild("invalid-input");

  const knowledge = validateHoidEditorialKnowledgeBundleManifest(
    raw.knowledgeManifest,
    sourceInput,
  );
  if (knowledge.status !== "valid") return invalidBuild("knowledge-bundle-invalid");
  if (knowledge.bundleStatus !== "ready-for-review") {
    return Object.freeze({
      status: "blocked",
      reason: "knowledge-bundle-blocked",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }

  const review = buildHoidEditorialReviewBundle(knowledge.manifest, sourceInput);
  if (review.status === "blocked") {
    return Object.freeze({
      status: "blocked",
      reason: "knowledge-bundle-blocked",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }
  if (review.status !== "ready-for-review") return invalidBuild("review-bundle-invalid");

  const receipts = validateHoidEditorialReviewBundleReceipts(
    review.manifest,
    knowledge.manifest,
    sourceInput,
    raw.receipts,
  );
  if (receipts.status === "invalid") return invalidBuild("review-bundle-invalid");
  if (receipts.status !== "complete") {
    return Object.freeze({
      status: "blocked",
      reason: "receipts-not-complete",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }

  const plan = buildHoidEditorialBundlePromotionPlan(
    review.manifest,
    knowledge.manifest,
    sourceInput,
    raw.receipts,
    raw.progressSnapshot,
  );
  if (plan.status === "blocked") {
    return Object.freeze({
      status: "blocked",
      reason: plan.reason === "invalid-progress" ? "progress-invalid" : "receipts-not-complete",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }
  if (plan.status !== "ready-for-protected-review") return invalidBuild("promotion-plan-invalid");

  const contextInput = Object.freeze({
    schemaVersion: 1 as const,
    ...contextRequest,
    promotionPlanFingerprint: plan.plan.fingerprint,
    reviewBundleFingerprint: review.manifest.fingerprint,
  });
  const context = validateHoidEditorialBundleReviewContext(plan.plan, contextInput);
  if (!context) return invalidBuild("context-invalid");

  const clonedKnowledge = jsonClone(knowledge.manifest);
  const clonedReview = jsonClone(review.manifest);
  const clonedSource = jsonClone(sourceInput);
  const clonedReceipts = jsonClone(raw.receipts);
  const clonedPlan = jsonClone(plan.plan);
  const clonedContext = jsonClone(context);
  const clonedPackets = jsonClone(review.packets);
  const spoilerScope = buildSpoilerScope(review.packets);

  if (
    clonedKnowledge === null ||
    clonedReview === null ||
    clonedSource === null ||
    clonedReceipts === null ||
    clonedPlan === null ||
    clonedContext === null ||
    clonedPackets === null
  ) return invalidBuild("size-limit");

  const base = {
    schemaVersion: 1 as const,
    kind: "hoid-editorial-review-kit" as const,
    catalogueFingerprint: HOID_SOURCE_CATALOG_MANIFEST.fingerprint,
    knowledgeManifest: clonedKnowledge as HoidEditorialKnowledgeBundleManifest,
    reviewManifest: clonedReview as HoidEditorialReviewBundleManifest,
    sourceInput: clonedSource as HoidEditorialReviewKitSourceInput,
    receipts: clonedReceipts as HoidEditorialReviewBundleReceipts,
    promotionPlan: clonedPlan as HoidEditorialBundlePromotionPlan,
    context: clonedContext as HoidEditorialBundleReviewContext,
    packets: clonedPackets as HoidEditorialReviewBundlePackets,
    spoilerScope,
    progressDisclosure: "revision-and-fingerprint-only" as const,
    sourcePassagesIncluded: false as const,
    privateEpubBytesIncluded: false as const,
    promotionAllowed: false as const,
    productionWritePerformed: false as const,
  };
  const serializedBase = JSON.stringify(base);
  if (serializedBase.length > MAX_REVIEW_KIT_CHARACTERS) return invalidBuild("size-limit");

  const kit: HoidEditorialReviewKit = deepFreeze({
    ...base,
    fingerprint: kitFingerprint(base),
  });
  const validation = validateHoidEditorialReviewKit(kit);
  if (validation.status !== "valid") return invalidBuild("review-kit-invalid");

  return Object.freeze({
    status: "ready",
    kit: validation.kit,
    packetCount: validation.packetCount,
    spoilerScopeCount: validation.spoilerScopeCount,
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

/**
 * Validate an exported kit without a raw progress ledger. The host must still
 * rebuild the promotion plan against live progress before accepting signatures.
 */
export function validateHoidEditorialReviewKit(value: unknown): HoidEditorialReviewKitValidation {
  const raw = exactDataRecord(value, KIT_KEYS);
  if (!raw || !isPlainJsonData(value)) {
    return Object.freeze({ status: "invalid", reason: "invalid-shape" });
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return Object.freeze({ status: "invalid", reason: "invalid-shape" });
  }
  if (serialized.length > MAX_REVIEW_KIT_CHARACTERS) {
    return Object.freeze({ status: "invalid", reason: "size-limit" });
  }

  if (
    raw.schemaVersion !== 1 ||
    raw.kind !== "hoid-editorial-review-kit" ||
    raw.progressDisclosure !== "revision-and-fingerprint-only" ||
    raw.sourcePassagesIncluded !== false ||
    raw.privateEpubBytesIncluded !== false ||
    raw.promotionAllowed !== false ||
    raw.productionWritePerformed !== false ||
    typeof raw.catalogueFingerprint !== "string" ||
    !SHA_PATTERN.test(raw.catalogueFingerprint) ||
    typeof raw.fingerprint !== "string" ||
    !SHA_PATTERN.test(raw.fingerprint)
  ) return Object.freeze({ status: "invalid", reason: "invalid-shape" });

  if (raw.catalogueFingerprint !== HOID_SOURCE_CATALOG_MANIFEST.fingerprint) {
    return Object.freeze({ status: "invalid", reason: "catalogue-mismatch" });
  }

  const knowledge = validateHoidEditorialKnowledgeBundleManifest(raw.knowledgeManifest, raw.sourceInput);
  if (knowledge.status !== "valid" || knowledge.bundleStatus !== "ready-for-review") {
    return Object.freeze({ status: "invalid", reason: "knowledge-bundle-invalid" });
  }

  const review = buildHoidEditorialReviewBundle(knowledge.manifest, raw.sourceInput);
  if (
    review.status !== "ready-for-review" ||
    JSON.stringify(review.manifest) !== JSON.stringify(raw.reviewManifest) ||
    JSON.stringify(review.packets) !== JSON.stringify(raw.packets)
  ) return Object.freeze({ status: "invalid", reason: "review-bundle-mismatch" });

  const receiptValidation = validateHoidEditorialReviewBundleReceipts(
    review.manifest,
    knowledge.manifest,
    raw.sourceInput,
    raw.receipts,
  );
  if (receiptValidation.status !== "complete") {
    return Object.freeze({ status: "invalid", reason: "receipts-invalid" });
  }

  const planValidation = validateHoidEditorialBundlePromotionPlan(raw.promotionPlan);
  if (planValidation.status !== "valid") {
    return Object.freeze({ status: "invalid", reason: "promotion-plan-mismatch" });
  }
  const plan = planValidation.plan;
  const reviewerIds = reviewerIdsFromReceipts(raw.receipts);
  const receiptJson = JSON.stringify(raw.receipts);
  if (
    !reviewerIds ||
    JSON.stringify(plan.receiptReviewerIds) !== JSON.stringify(reviewerIds) ||
    plan.reviewBundleFingerprint !== review.manifest.fingerprint ||
    plan.knowledgeBundleFingerprint !== knowledge.manifest.fingerprint ||
    plan.receiptsFingerprint !== sha256Hex(receiptJson) ||
    plan.packetCount !== review.manifest.packets.length ||
    JSON.stringify(plan.packets) !== JSON.stringify(review.manifest.packets)
  ) return Object.freeze({ status: "invalid", reason: "promotion-plan-mismatch" });

  const context = validateHoidEditorialBundleReviewContext(plan, raw.context);
  if (!context || JSON.stringify(context) !== JSON.stringify(raw.context)) {
    return Object.freeze({ status: "invalid", reason: "context-mismatch" });
  }

  const spoilerScope = buildSpoilerScope(review.packets);
  if (JSON.stringify(spoilerScope) !== JSON.stringify(raw.spoilerScope)) {
    return Object.freeze({ status: "invalid", reason: "spoiler-scope-mismatch" });
  }

  const fingerprintBase = {
    schemaVersion: 1 as const,
    kind: "hoid-editorial-review-kit" as const,
    catalogueFingerprint: raw.catalogueFingerprint,
    knowledgeManifest: knowledge.manifest,
    reviewManifest: review.manifest,
    sourceInput: raw.sourceInput as HoidEditorialReviewKitSourceInput,
    receipts: raw.receipts as HoidEditorialReviewBundleReceipts,
    promotionPlan: plan,
    context,
    packets: review.packets,
    spoilerScope,
    progressDisclosure: "revision-and-fingerprint-only" as const,
    sourcePassagesIncluded: false as const,
    privateEpubBytesIncluded: false as const,
    promotionAllowed: false as const,
    productionWritePerformed: false as const,
  };
  if (kitFingerprint(fingerprintBase) !== raw.fingerprint) {
    return Object.freeze({ status: "invalid", reason: "fingerprint-mismatch" });
  }

  const canonicalKit = deepFreeze(JSON.parse(serialized) as HoidEditorialReviewKit);
  return Object.freeze({
    status: "valid",
    kit: canonicalKit,
    packetCount: review.manifest.packets.length,
    spoilerScopeCount: spoilerScope.length,
  });
}

/** Serialize only a fully revalidated, bounded reviewer kit. */
export function serializeHoidEditorialReviewKit(value: unknown): HoidEditorialReviewKitSerialization {
  const validation = validateHoidEditorialReviewKit(value);
  if (validation.status !== "valid") {
    return Object.freeze({ status: "invalid", reason: "invalid-kit" });
  }
  const json = JSON.stringify(validation.kit);
  if (json.length > MAX_REVIEW_KIT_CHARACTERS) {
    return Object.freeze({ status: "invalid", reason: "size-limit" });
  }
  return Object.freeze({
    status: "ready",
    json,
    fingerprint: validation.kit.fingerprint,
  });
}

/** Parse and revalidate a portable reviewer kit; JSON parsing never grants trust. */
export function parseHoidEditorialReviewKit(value: unknown): HoidEditorialReviewKitParseResult {
  if (typeof value !== "string") {
    return Object.freeze({ status: "invalid", reason: "invalid-json" });
  }
  if (value.length > MAX_REVIEW_KIT_CHARACTERS) {
    return Object.freeze({ status: "invalid", reason: "size-limit" });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return Object.freeze({ status: "invalid", reason: "invalid-json" });
  }
  return validateHoidEditorialReviewKit(parsed);
}
